import pg from 'pg';
import {validateDatabaseUrl} from './database-config.js';
import type {Interaction} from '../shared/schema.js';
export interface InteractionStore {record(event:Interaction):Promise<boolean>;counts():Promise<Map<string,number>>;health():Promise<boolean>}
export class MemoryInteractionStore implements InteractionStore {
 private events=new Map<string,{placeId:string;sessionId:string;time:number}>();
 private prune(){const cutoff=Date.now()-7*86400000;for(const [key,event]of this.events)if(event.time<cutoff)this.events.delete(key);}
 async record(e:Interaction){this.prune();const key=`${e.sessionId}:${e.placeId}:${e.eventType}`;if(this.events.has(key))return false;if(this.events.size>=10000)this.events.delete(this.events.keys().next().value!);this.events.set(key,{placeId:e.placeId,sessionId:e.sessionId,time:Date.now()});return true;}
 async counts(){this.prune();const unique=new Map<string,Set<string>>();for(const e of this.events.values()){if(!unique.has(e.placeId))unique.set(e.placeId,new Set());unique.get(e.placeId)!.add(e.sessionId);}return new Map([...unique].map(([id,sessions])=>[id,sessions.size]));}
 async health(){return true;}
}
export class PostgresInteractionStore implements InteractionStore {
 pool:pg.Pool;
 constructor(connectionString:string){this.pool=new pg.Pool({connectionString:validateDatabaseUrl(connectionString),max:5,connectionTimeoutMillis:5000,statement_timeout:5000});this.pool.on('error',()=>console.error('Database pool connection error'));}
 async record(e:Interaction){const r=await this.pool.query('INSERT INTO interaction_events(place_id,event_type,session_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[e.placeId,e.eventType,e.sessionId]);return !!r.rowCount;}
 async counts(){const r=await this.pool.query("SELECT place_id,COUNT(DISTINCT session_id)::int AS count FROM interaction_events WHERE created_at > now() - interval '7 days' GROUP BY place_id");return new Map<string,number>(r.rows.map(r=>[r.place_id,r.count]));}
 async health(){await this.pool.query('SELECT 1 FROM interaction_events LIMIT 1');return true;}
}
