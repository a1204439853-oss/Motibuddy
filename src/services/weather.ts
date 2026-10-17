export type WeatherPlace={name:string;latitude:number;longitude:number};
export const BEIJING:WeatherPlace={name:'北京',latitude:39.9042,longitude:116.4074};
export const usablePlace=(place?:WeatherPlace):WeatherPlace=>!place||/^(我的位置|My location)$/i.test(place.name)?BEIJING:place;
export type WeatherHour={time:string;temperature:number;code:number;rain:number|null};
export type WeatherData={temperature:number;code:number;high:number;low:number;wind:number;direction:number|null;feels:number|null;humidity:number|null;pressure:number|null;visibility:number|null;uv:number|null;sunrise:string|null;sunset:string|null;localTime:string;at:string;hours:WeatherHour[]};
export type AirQuality={aqi:number;pm25:number|null;pm10:number|null};
const finite=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
export function parseWeather(d:any):WeatherData{
 const c=d?.current,dy=d?.daily,h=d?.hourly;
 if(![c?.temperature_2m,c?.weather_code,c?.wind_speed_10m,dy?.temperature_2m_max?.[0],dy?.temperature_2m_min?.[0]].every(v=>finite(v)!==null))throw Error('WEATHER_UNAVAILABLE');
 const localTime=typeof c.time==='string'?c.time:'',times=Array.isArray(h?.time)?h.time:[];
 const index=times.findIndex((t:unknown)=>typeof t==='string'&&t.slice(0,13)===localTime.slice(0,13));
 const hours=times.map((time:string,i:number)=>({time,temperature:h.temperature_2m?.[i],code:h.weather_code?.[i],rain:finite(h.precipitation_probability?.[i])})).filter((v:WeatherHour)=>typeof v.time==='string'&&v.time>=localTime.slice(0,13)+':00'&&finite(v.temperature)!==null&&finite(v.code)!==null).slice(0,24);
 return {temperature:c.temperature_2m,code:c.weather_code,high:dy.temperature_2m_max[0],low:dy.temperature_2m_min[0],wind:c.wind_speed_10m,direction:finite(c.wind_direction_10m),feels:finite(c.apparent_temperature),humidity:finite(c.relative_humidity_2m),pressure:finite(c.surface_pressure),visibility:index<0?null:finite(h.visibility?.[index]),uv:index<0?null:finite(h.uv_index?.[index]),sunrise:typeof dy.sunrise?.[0]==='string'?dy.sunrise[0]:null,sunset:typeof dy.sunset?.[0]==='string'?dy.sunset[0]:null,localTime,at:new Date().toISOString(),hours};
}
export async function fetchWeather(place:WeatherPlace,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const params=new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),current:'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,relative_humidity_2m,surface_pressure',hourly:'temperature_2m,weather_code,precipitation_probability,visibility,uv_index',daily:'temperature_2m_max,temperature_2m_min,sunrise,sunset',timezone:'auto',forecast_days:'2'});
 const r=await fetcher('https://api.open-meteo.com/v1/forecast?'+params,{signal});if(!r.ok)throw Error('WEATHER_UNAVAILABLE');return parseWeather(await r.json());
}
export async function fetchAirQuality(place:WeatherPlace,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<AirQuality>{
 const params=new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),current:'us_aqi,pm2_5,pm10',timezone:'auto'});
 const r=await fetcher('https://air-quality-api.open-meteo.com/v1/air-quality?'+params,{signal});if(!r.ok)throw Error('AIR_QUALITY_UNAVAILABLE');const d=await r.json(),aqi=finite(d.current?.us_aqi);if(aqi===null||aqi<0)throw Error('AIR_QUALITY_UNAVAILABLE');return {aqi,pm25:finite(d.current.pm2_5),pm10:finite(d.current.pm10)};
}
// Only call with coordinates freshly supplied by the device after explicit consent.
export async function resolveCurrentCity(latitude:number,longitude:number,locale:string,fetcher:typeof fetch=fetch):Promise<WeatherPlace>{
 const params=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),localityLanguage:locale==='zh-CN'?'zh':'en'});
 const r=await fetcher('https://api.bigdatacloud.net/data/reverse-geocode-client?'+params,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('CITY_UNAVAILABLE');const d=await r.json();const name=[d.city,d.locality].find(v=>typeof v==='string'&&v.trim());if(!name)throw Error('CITY_UNAVAILABLE');return {name:name.trim().slice(0,100),latitude,longitude};
}
export function airQualityBand(aqi:number){return aqi<=50?0:aqi<=100?1:aqi<=150?2:aqi<=200?3:aqi<=300?4:5;}
export function windDirection(degrees:number|null,locale:string){if(degrees===null)return '—';const index=Math.round(((degrees%360)+360)%360/45)%8;return (locale==='zh-CN'?['北风','东北风','东风','东南风','南风','西南风','西风','西北风']:['N','NE','E','SE','S','SW','W','NW'])[index];}
