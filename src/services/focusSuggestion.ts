export const FOCUS_SUGGESTION_INTERVAL=10*60*1000;
export function claimFocusSuggestion(settings:Record<string,unknown>,now=new Date()){
 const previous=typeof settings.assistantFocusPromptedAt==='string'?Date.parse(settings.assistantFocusPromptedAt):NaN;
 if(Number.isFinite(previous)&&+now-previous<FOCUS_SUGGESTION_INTERVAL)return {show:false,settings};
 return {show:true,settings:{...settings,assistantFocusPromptedAt:now.toISOString()}};
}
