import test from 'node:test';
import assert from 'node:assert/strict';
import {BEIJING,usablePlace,parseWeather,fetchWeather,fetchAirQuality,resolveCurrentCity,airQualityBand,windDirection} from '../src/services/weather.ts';
import {claimFocusSuggestion,FOCUS_SUGGESTION_INTERVAL} from '../src/services/focusSuggestion.ts';
import {decodeBusinessData} from '../src/services/businessRepository.ts';

test('default city is Beijing and legacy generic location names never masquerade as a detected city',()=>{
 assert.deepEqual(usablePlace(),BEIJING);assert.deepEqual(usablePlace({name:'我的位置',latitude:1,longitude:2}),BEIJING);const city={name:'杭州',latitude:30.25,longitude:120.16};assert.deepEqual(usablePlace(city),city);
});
test('extended weather preserves missing values and selects hourly data in the city timezone',async()=>{
 const data={current:{time:'2026-10-17T09:15',temperature_2m:18,weather_code:2,wind_speed_10m:10,wind_direction_10m:315,apparent_temperature:17,relative_humidity_2m:52,surface_pressure:1007},daily:{temperature_2m_max:[20],temperature_2m_min:[10],sunrise:['2026-10-17T06:28'],sunset:['2026-10-17T17:33']},hourly:{time:['2026-10-17T08:00','2026-10-17T09:00','2026-10-17T10:00'],temperature_2m:[17,18,20],weather_code:[1,2,3],precipitation_probability:[null,0,10],visibility:[20000,30000,null],uv_index:[0,1,2]}};
 const weather=parseWeather(data);assert.equal(weather.hours[0].time,'2026-10-17T09:00');assert.equal(weather.humidity,52);assert.equal(weather.visibility,30000);assert.equal(weather.uv,1);assert.equal(weather.sunset.slice(11,16),'17:33');assert.equal(windDirection(weather.direction,'zh-CN'),'西北风');
 const missing=parseWeather({...data,current:{temperature_2m:10,weather_code:0,wind_speed_10m:3},hourly:undefined});assert.equal(missing.feels,null);assert.equal(missing.humidity,null);assert.equal(missing.uv,null);assert.equal(missing.visibility,null);assert.deepEqual(missing.hours,[]);assert.throws(()=>parseWeather({current:{temperature_2m:NaN}}));
 let url;await fetchWeather(BEIJING,new AbortController().signal,async u=>{url=u;return new Response(JSON.stringify(data));});assert.ok(url.includes('surface_pressure')&&url.includes('sunrise')&&url.includes('uv_index'));
});
test('AQI is explicitly US AQI, has correct category boundaries and never defaults to an invented good score',async()=>{
 assert.deepEqual([0,50,51,100,101,150,151,200,201,300,301].map(airQualityBand),[0,0,1,1,2,2,3,3,4,4,5]);
 const r=await fetchAirQuality(BEIJING,new AbortController().signal,async()=>new Response(JSON.stringify({current:{us_aqi:19,pm2_5:3}})));assert.deepEqual(r,{aqi:19,pm25:3,pm10:null});await assert.rejects(fetchAirQuality(BEIJING,new AbortController().signal,async()=>new Response('{}')));
});
test('reverse geocoding returns an actual city and fails rather than inventing one',async()=>{
 let target;const result=await resolveCurrentCity(30.25,120.16,'zh-CN',async url=>{target=String(url);return new Response(JSON.stringify({city:'杭州市',locality:'西湖区'}));});assert.equal(result.name,'杭州市');assert.ok(target.startsWith('https://api.bigdatacloud.net/data/reverse-geocode-client?'));assert.ok(target.includes('localityLanguage=zh'));await assert.rejects(resolveCurrentCity(1,2,'en-US',async()=>new Response('{}')));
});
test('focus invitation cooldown is shared across scenarios, durable per account, and honors the exact ten-minute boundary',()=>{
 const now=new Date('2026-10-17T08:00:00Z'),first=claimFocusSuggestion({},now);assert.equal(first.show,true);for(const elapsed of [1,300000,FOCUS_SUGGESTION_INTERVAL-1])assert.equal(claimFocusSuggestion(first.settings,new Date(+now+elapsed)).show,false);assert.equal(claimFocusSuggestion(first.settings,new Date(+now+FOCUS_SUGGESTION_INTERVAL)).show,true);assert.equal(claimFocusSuggestion(first.settings,new Date(+now-1000)).show,false);assert.equal(claimFocusSuggestion({},now).show,true);
 const valid=decodeBusinessData({tasks:[],pet:null,achievements:[],settings:first.settings},'user-a');assert.equal(valid.settings.assistantFocusPromptedAt,now.toISOString());assert.throws(()=>decodeBusinessData({...valid,settings:{assistantFocusPromptedAt:'bad'}},'user-a'));
});
