import {Bus,TrainFront,Footprints} from 'lucide-react';
import type {Route} from '../../shared/schema';
import {segmentColor,transitVehicle,routeSteps} from '../../shared/transit';
export function TransitDirections({route}:{route?:Route}){
 const rides=routeSteps(route?.segments??[]).filter(segment=>segment.travelMode!=='DRIVE');
 if(!rides.length)return null;
 return <section className="transit-directions" aria-label="Walking and transit directions"><h3>Route steps</h3><ol>{rides.map((ride,i)=>{if(ride.travelMode==='WALK')return <li key={i} className="walking-step"><Footprints size={16}/><div><strong>Walk{ride.durationSeconds!==undefined?` ${Math.max(1,Math.ceil(ride.durationSeconds/60))} min`:''}</strong>{ride.distanceMeters!==undefined&&<span> · {Math.round(ride.distanceMeters)} m</span>}<p>{ride.startLabel?`From ${ride.startLabel}`:'Walk from the previous stop'}{ride.endLabel?` to ${ride.endLabel}`:rides[i+1]?.departureStop?` to ${rides[i+1].departureStop!.name}`:' to the next stop'}</p></div></li>;const vehicle=transitVehicle(ride),Icon=vehicle==='Bus'?Bus:TrainFront;return <li key={i}>
 <div className="transit-ride-heading"><span className="transit-line-badge" style={{borderColor:segmentColor(ride)}}><Icon size={15}/>{ride.lineName??vehicle}</span>{ride.headsign&&<span>toward {ride.headsign}</span>}{ride.stopCount!==undefined&&<span>{ride.stopCount} {ride.stopCount===1?'stop':'stops'}</span>}</div>
 <div className="transit-ride-stops" style={{borderColor:segmentColor(ride)}}><p><strong>Board</strong> {ride.departureStop?.name??'Boarding stop unavailable'}</p><p><strong>Get off</strong> {ride.arrivalStop?.name??'Arrival stop unavailable'}</p></div>
 </li>;})}</ol></section>;
}
