import {pointSchema,type Point} from '../../shared/schema';
export interface LiveLocation {point:Point;accuracy:number;timestamp:number}
// Keep the watch independent of React so cleanup and late callbacks are testable.
export function watchLiveLocation(geolocation:Geolocation,onLocation:(location:LiveLocation)=>void,onError:(message:string)=>void){
 let active=true,attempt=0;
 let watchId:number|undefined;
 const clear=()=>{if(watchId!==undefined){geolocation.clearWatch(watchId);watchId=undefined;}};
 const stop=()=>{active=false;clear();};
 const fail=(message:string)=>{stop();onError(message);};
 function start(highAccuracy:boolean){
  clear();const current=++attempt;
  try{
   const id=geolocation.watchPosition(position=>{
    if(!active||current!==attempt)return;
    const point=pointSchema.safeParse({lat:position.coords.latitude,lng:position.coords.longitude});
    if(!point.success){fail('Location was found, but it is outside the supported Boston area. Enter a Boston starting address.');return;}
    if(!Number.isFinite(position.coords.accuracy)||position.coords.accuracy<0||!Number.isFinite(position.timestamp)||Date.now()-position.timestamp>30000)return;
    onLocation({point:point.data,accuracy:position.coords.accuracy,timestamp:position.timestamp});
   },error=>{
    if(!active||current!==attempt)return;
    // Some desktops cannot obtain a high-accuracy fix. Retry using the browser's
    // available location sources before reporting a timeout or unavailable error.
    if(highAccuracy&&(error.code===2||error.code===3)){start(false);return;}
    fail(error.code===1?'Location permission was denied. Allow location for this site and enable Location Services for your browser in system settings, then try again.':error.code===3?'Location timed out after retrying. Check system Location Services and your connection, then try again or enter a starting address.':'Your location is unavailable after retrying. Enable system Location Services for your browser, then try again or enter a starting address.');
   },{enableHighAccuracy:highAccuracy,timeout:15000,maximumAge:0});
   if(!active||current!==attempt)geolocation.clearWatch(id);else watchId=id;
  }catch{if(active&&current===attempt)fail('Location could not start. Check your browser and system Location Services settings or enter a starting address.');}
 }
 start(true);
 return stop;
}
