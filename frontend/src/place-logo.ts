import type {Place} from '../../shared/schema';

export const fallbackLogo='/on-the-go.svg';

export function placeLogoUrl(place:Pick<Place,'websiteUri'>){
 if(!place.websiteUri)return;
 try{
  const website=new URL(place.websiteUri);
  if(!['https:','http:'].includes(website.protocol)||!website.hostname)return;
  // Send only the public hostname, not paths, query strings, or credentials.
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(website.hostname)}&sz=128`;
 }catch{return;}
}

export function useFallbackLogo(image:HTMLImageElement){
 if(image.getAttribute('src')!==fallbackLogo)image.src=fallbackLogo;
}

export function createPlaceLogoImage(place:Pick<Place,'websiteUri'>){
 const image=document.createElement('img');
 image.className='place-logo';image.alt='';image.referrerPolicy='no-referrer';
 image.src=placeLogoUrl(place)??fallbackLogo;
 image.onerror=()=>useFallbackLogo(image);
 return image;
}
