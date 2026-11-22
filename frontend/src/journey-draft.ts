import type {JourneyInput,Location} from '../../shared/schema';
function sameLocation(a:Location,b:Location){
 // The route service resolves typed addresses into coordinates. Those added
 // coordinates aren't a user edit; compare coordinates only when supplied.
 return a.label===b.label&&a.placeId===b.placeId&&(!a.point||(a.point.lat===b.point?.lat&&a.point.lng===b.point?.lng));
}
export function journeyDraftChanged(draft:JourneyInput,planned:JourneyInput){
 // Device coordinates keep moving, but stop routes belong to the submitted
 // journey snapshot. A new submission will use the latest device coordinates.
 const deviceOrigin=draft.origin.label==='My current location'&&planned.origin.label==='My current location'&&!!draft.origin.point&&!!planned.origin.point&&!draft.origin.placeId&&!planned.origin.placeId;
 return draft.mode!==planned.mode||!sameLocation(draft.destination,planned.destination)||(!deviceOrigin&&!sameLocation(draft.origin,planned.origin));
}
