import type {Recommendation} from '../../shared/schema';

// Use the same letters in the map, results, and selected-stop list. Keep stops
// that are hidden by the current filters on the map, after visible results.
export function foodMarkerLabels(places:Recommendation[],stops:Recommendation[]){
 const ids=[...new Set([...places,...stops].map(place=>place.id))];
 return new Map(ids.map((id,index)=>[id,String.fromCharCode(65+index)]));
}
