import type {JourneyInput,Place,Route,Filters} from '../../shared/schema.js';
export interface Provider {route(input:JourneyInput,stop?:Place):Promise<Route>;search(input:JourneyInput,baseline:Route,filters:Filters):Promise<Place[]>;details(id:string):Promise<Place>}
export class AppError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
