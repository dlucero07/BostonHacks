import {z} from 'zod';
export const pointSchema=z.object({lat:z.number().min(42.2).max(42.45),lng:z.number().min(-71.25).max(-70.9)});
export type Point=z.infer<typeof pointSchema>;
export const locationSchema=z.object({label:z.string().trim().min(2).max(200),point:pointSchema.optional(),placeId:z.string().max(200).optional()});
export type Location=z.infer<typeof locationSchema>;
export const journeySchema=z.object({origin:locationSchema,destination:locationSchema,mode:z.enum(['WALK','DRIVE'])});
export type JourneyInput=z.infer<typeof journeySchema>;
export const filterSchema=z.object({category:z.enum(['all','restaurant','cafe','bakery']).default('all'),maxPrice:z.number().int().min(1).max(4).optional(),minRating:z.number().min(0).max(5).default(0),maxDetour:z.union([z.literal(5),z.literal(10),z.literal(15)]).default(10),vegetarian:z.boolean().default(false)});
export type Filters=z.infer<typeof filterSchema>;
export const searchSchema=z.object({journeyId:z.string().uuid(),filters:filterSchema});
export const stopSchema=z.object({journeyId:z.string().uuid(),placeId:z.string().min(1).max(200)});
export const interactionSchema=z.object({placeId:z.string().min(1).max(200),eventType:z.enum(['select','details','add_stop']),sessionId:z.string().uuid()});
export type Interaction=z.infer<typeof interactionSchema>;
export interface Route {durationSeconds:number;distanceMeters:number;path:Point[];encodedPolyline?:string;simulated:boolean}
export interface Place {id:string;name:string;category:'restaurant'|'cafe'|'bakery';categoryLabel:string;point:Point;rating?:number;reviewCount?:number;price?:number;openNow?:boolean;vegetarian?:boolean;address?:string;mapsUri?:string;attributions?:{displayName:string;uri?:string}[]}
export interface Recommendation extends Place {extraSeconds:number;popularity:number;score:number;reason:string;route:Route}
export interface Journey extends JourneyInput {id:string;baseline:Route}
export interface SearchResult {restaurants:Recommendation[];warning?:string}
export interface Config {mode:'demo'|'live';browserKey?:string;mapId?:string}
