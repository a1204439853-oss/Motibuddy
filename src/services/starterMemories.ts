import type {User,Pet} from '../types/index.ts';
import {localDateKey} from './companionRecords.ts';
export function initialMemories(settings:Record<string,unknown>,user:User,pet:Pet,photo?:string){
 if(settings.starterMemoriesVersion===1)return settings;
 const adopted=new Date(pet.createdAt),registered=new Date(user.createdAt),time=adopted.toISOString();
 const journal={id:crypto.randomUUID(),createdAt:time,updatedAt:time,title:`第一次遇见${pet.name}`,body:`在 ${adopted.toLocaleDateString('zh-CN')}，我领养了自己的小伙伴——${pet.name}。\n从这一天开始，日常的计划和小小的进步，都多了一份陪伴。\n这是我们的第一页手账。你好，${pet.name}，以后请多关照。`,reflection:'',images:photo?[photo]:[],stickers:[{symbol:'🐾',x:83,y:12}],strokes:[]};
 return {...settings,starterMemoriesVersion:1,...(!Array.isArray(settings.journalEntries)||!settings.journalEntries.length?{journalEntries:[journal]}:{}),...(!Array.isArray(settings.anniversaries)||!settings.anniversaries.length?{anniversaries:[{id:crypto.randomUUID(),title:'祝贺第一次注册 MotiBuddy ♡',date:localDateKey(registered),yearly:true,style:'sunshine'}]}:{})};
}
