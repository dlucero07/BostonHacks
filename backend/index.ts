import 'dotenv/config';
import {createApp} from './app.js';
import {DemoProvider} from './providers/demo.js';
import {GoogleProvider} from './providers/google.js';
import {MemoryInteractionStore,PostgresInteractionStore} from './storage.js';
const mode=process.env.APP_MODE??'demo';
if(mode!=='demo'&&mode!=='live')throw new Error('APP_MODE must be demo or live');
const configured=(v:string|undefined)=>!!v&&!v.includes('YOUR_');
if(mode==='live'&&(!configured(process.env.GOOGLE_MAPS_SERVER_KEY)||!configured(process.env.GOOGLE_MAPS_BROWSER_KEY)||!configured(process.env.GOOGLE_MAP_ID)))throw new Error('Live mode requires GOOGLE_MAPS_SERVER_KEY, GOOGLE_MAPS_BROWSER_KEY, and GOOGLE_MAP_ID. See .env.example.');
if((mode==='live'||process.env.REQUIRE_DATABASE==='true')&&!configured(process.env.DATABASE_URL))throw new Error('Set DATABASE_URL and run npm run db:migrate.');
const store=configured(process.env.DATABASE_URL)?new PostgresInteractionStore(process.env.DATABASE_URL!):new MemoryInteractionStore();
const app=createApp(mode==='demo'?new DemoProvider():new GoogleProvider(process.env.GOOGLE_MAPS_SERVER_KEY!),store,{mode,...(mode==='live'?{browserKey:process.env.GOOGLE_MAPS_BROWSER_KEY,mapId:process.env.GOOGLE_MAP_ID}:{})});
const server=app.listen(Number(process.env.PORT??3000),'0.0.0.0',()=>console.log(`On-the-Go (${mode}) http://localhost:${process.env.PORT??3000}`));
server.on('error',(error:NodeJS.ErrnoException)=>{
 console.error(error.code==='EADDRINUSE'?`Port ${process.env.PORT??3000} is already in use. Stop the previous app server before running npm run dev again.`:`Server could not start (${error.code??'unknown error'}).`);
 process.exit(1);
});
process.on('SIGTERM',()=>server.close(()=>{if(store instanceof PostgresInteractionStore)void store.pool.end();}));
