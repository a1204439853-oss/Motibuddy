import {fetchWeather,fetchAirQuality,BEIJING} from '../src/services/weather.ts';
import {writeFile} from 'node:fs/promises';
const results=await Promise.allSettled([fetchWeather(BEIJING,AbortSignal.timeout(20000)),fetchAirQuality(BEIJING,AbortSignal.timeout(20000))]);
const report={checkedAt:new Date().toISOString(),location:'Beijing public reference coordinates',checks:results.map((r,index)=>({name:index?'air-quality-api':'extended-weather-api',passed:r.status==='fulfilled',...(r.status==='fulfilled'?index?{aqiAvailable:Number.isFinite(r.value.aqi)}:{hourlyEntries:r.value.hours.length,feelsAvailable:r.value.feels!==null,humidityAvailable:r.value.humidity!==null,pressureAvailable:r.value.pressure!==null,visibilityAvailable:r.value.visibility!==null,uvAvailable:r.value.uv!==null,sunTimesAvailable:!!r.value.sunrise&&!!r.value.sunset}:{})}))};
await writeFile('docs/WEATHER_API_VERIFICATION.json',JSON.stringify(report,null,2)+'\n');
for(const c of report.checks)console.log(`${c.passed?'PASS':'FAIL'} ${c.name}`);
if(report.checks.some(c=>!c.passed))process.exitCode=1;
