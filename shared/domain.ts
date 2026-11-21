import type {Filters,Place,Recommendation} from './schema.js';
export const popularityConfig={priorRating:4.1,priorReviews:50,reviewCap:2000,interactionCap:50,weights:{rating:.55,volume:.3,interactions:.15}};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function popularity(place:Place,uniqueInteractions=0){
 const c=popularityConfig,n=Math.max(0,place.reviewCount??0),rating=place.rating??c.priorRating;
 const bayesian=(n*rating+c.priorReviews*c.priorRating)/(n+c.priorReviews);
 return clamp(c.weights.rating*clamp((bayesian-1)/4)+c.weights.volume*clamp(Math.log1p(n)/Math.log1p(c.reviewCap))+c.weights.interactions*clamp(Math.log1p(Math.max(0,uniqueInteractions))/Math.log1p(c.interactionCap)));
}
export function extraTravelSeconds(direct:number,withStop:number){if(!Number.isFinite(direct)||!Number.isFinite(withStop)||direct<0||withStop<0)throw new Error('Invalid duration');return Math.max(0,withStop-direct);}
export function matches(place:Place,f:Filters){return (f.category==='all'||place.category===f.category)&&(!f.maxPrice||(place.price!==undefined&&place.price<=f.maxPrice))&&(f.minRating===0||(place.rating!==undefined&&place.rating>=f.minRating));}
export function rank(place:Place,extraSeconds:number,f:Filters,interactions=0){const p=popularity(place,interactions);return .45*p+.55*(1-clamp(extraSeconds/(f.maxDetour*60)));}
export function enforceDetour(places:Recommendation[],f:Filters){return places.filter(p=>matches(p,f)&&p.extraSeconds<=f.maxDetour*60).sort((a,b)=>b.score-a.score);}
export const markerSize=(score:number)=>24+40*Math.max(0,Math.min(1,score))**2;
export function decodePolyline(encoded:string){let index=0,lat=0,lng=0;const points=[];while(index<encoded.length){const read=()=>{let result=0,shift=0,b;do{if(index>=encoded.length||shift>30)throw new Error('Invalid route geometry');b=encoded.charCodeAt(index++)-63;result|=(b&31)<<shift;shift+=5;}while(b>=32);return result&1?~(result>>1):result>>1;};lat+=read();lng+=read();points.push({lat:lat/1e5,lng:lng/1e5});}return points;}

export const popularityLabel=(score:number)=>score>=.75?'Very popular':score>=.6?'Popular':'Quieter pick';
