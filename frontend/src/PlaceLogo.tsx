import type {Place} from '../../shared/schema';
import {fallbackLogo,placeLogoUrl,useFallbackLogo} from './place-logo';

export function PlaceLogo({place}:{place:Pick<Place,'websiteUri'>}){
 return <img className="place-logo" src={placeLogoUrl(place)??fallbackLogo} alt="" referrerPolicy="no-referrer" onError={event=>useFallbackLogo(event.currentTarget)}/>;
}
