import {useCallback,useEffect,useRef,useState} from 'react';
import {watchLiveLocation,type LiveLocation} from './live-location';
export function useLiveLocation(onLocation:(location:LiveLocation)=>void,autoStart=false){
 const [location,setLocation]=useState<LiveLocation>(),[tracking,setTracking]=useState(false),[error,setError]=useState(''),[locating,setLocating]=useState(autoStart);
 const cleanup=useRef<(()=>void)|undefined>(undefined),callback=useRef(onLocation);
 callback.current=onLocation;
 const stop=useCallback(()=>{cleanup.current?.();cleanup.current=undefined;setTracking(false);setLocation(undefined);setLocating(false);},[]);
 const start=useCallback(()=>{
  stop();setError('');
  if(!window.isSecureContext){setError('Location is blocked on this HTTP address. Open http://localhost:5173 on this computer, or use HTTPS when accessing from another device.');return;}
  if(!navigator.geolocation){setError('Your browser does not support live location. Enter a starting address instead.');return;}
  setTracking(true);setLocating(true);
  cleanup.current=watchLiveLocation(navigator.geolocation,next=>{setLocating(false);setLocation(next);setError('');callback.current(next);},message=>{setLocating(false);setTracking(false);setLocation(undefined);setError(message);});
 },[stop]);
 useEffect(()=>{if(autoStart)start();return()=>cleanup.current?.();},[autoStart,start]);
 return {location,tracking,locating,error,start,stop};
}
