import {personalitySchema,type Personality} from './productData.ts';
type Pool=Record<Personality,string[]>;
const greetings:Pool={
 gentle:['你一来，这里就热闹了一点。','今天过得怎么样？想说的话，我都在听。','不用赶着变厉害，先陪我坐一小会儿吧。','收到摸摸啦，心里暖暖的。'],
 tsundere:['才不是一直在等你呢！……不过你来了就别急着走。','哼，手感这么好，只许你再摸一下。','今天要是有人惹你不开心，先来我这儿躲一会儿。','你笑一下嘛。不是想看，随口说说而已！'],
 witty:['摸头免费，烦恼寄存也免费。今天这买卖划算吧。','外面的世界太吵？这里提供暂时停止营业服务。','你这手法不错，建议加入长期饭票套餐。','别人的进度条先关掉，你自己的电量更值得关心。'],
 humorous:['叮咚！一只快乐小动物被你摸开机了。','本店今日特供：抱抱无限续杯！','心情预报：你附近有一小团开心正在靠近。','如果快乐有尾巴，我现在大概摇成电风扇了。'],
 cool:['我在。想待多久都可以。','过来坐。不想说话也没关系。','嗯，听着呢。','今天辛苦了。这里给你留了位置。'],
 soft:['贴贴～你的摸摸像一小块暖暖的阳光。','悄悄把一朵小花放进你口袋，今天也有人惦记你呀。','你来啦！我把最软乎乎的位置留给你。','蹭蹭你，烦恼可以先放我这里一会儿喔。']
};
const fed:Pool={
 gentle:['吃饱啦，连心情都变得圆滚滚的。','谢谢你记得我的小肚子。你今天有好好吃饭吗？','这口好香，想把满足分你一半。'],
 tsundere:['也、也就一般好吃吧……还有吗？','哼，知道本大人喜欢这个，算你有眼光。','吃得这么满足可不许告诉别人。尤其是刚才舔碗那段。'],
 witty:['干饭这件事，我向来执行力拉满。','肚子已充值。谢谢老板，祝老板顿顿有好菜。','生活偶尔很复杂，这口饭倒是简单又靠谱。'],
 humorous:['小肚子发来五星好评，并申请再来一单。','美食一入口，尾巴自动切到快乐频道！','刚刚吃下去的不是饭，是一整碗幸福。'],
 cool:['好吃。谢谢。','吃饱了。你也去吃点东西。','这顿，我很喜欢。'],
 soft:['啊呜～肚肚暖起来啦，谢谢你喂我呀。','吃饱饱啦，软乎乎的快乐分你一半～','嗝，偷偷打个幸福的小饱嗝，别笑我嘛。']
};
const play:Pool={
 gentle:['和你玩的时候，时间总是跑得很快。','刚才那一下真开心，再笑一会儿吧。','谢谢你陪我，今天又多了一段喜欢的小回忆。'],
 tsundere:['刚才是我让着你啦！再来一局你就知道了。','谁说我玩得很开心？尾巴它自己要摇的！','下次还找你玩。只是因为你勉强配得上当我的搭档。'],
 witty:['成年人也有游戏时间，谁规定的？我刚规定的。','刚才那点烦心事，被我们甩出界外了。','报告，快乐指标超额完成，建议保持。'],
 humorous:['快乐到想绕房间跑三圈！算了，先喘口气。','今日最佳搭子奖颁给你，奖品是我再陪你玩一次。','我的快乐雷达滴滴滴响个不停，全是因为你！'],
 cool:['不错。下次还一起。','很开心。真的。','歇一会儿。我陪着。'],
 soft:['嘿咻！和你一起玩，连空气都甜甜的～','玩得好开心呀！给最棒的搭子一个毛茸茸的抱抱。','笑得耳朵都晃起来啦，今天的小快乐要偷偷藏好。']
};
const thinking:Pool={gentle:['你的话我接住啦，正在认真想。','等我一下下，我想好好回答你。'],tsundere:['才不是被难住了！我只是想给你一个漂亮答案。','哼，这题值得本大人认真想一下。'],witty:['脑子正在热身，暂时别拍机器。','正在翻箱倒柜找答案，等我捋捋。'],humorous:['别催别催，脑子正在加热中！','稍等哦，我去脑子里抓个小精灵。','叮！思考模式启动中！'],cool:['我在。正在想。','稍等，整理一下。'],soft:['贴贴～你等我一小会儿，答案正在路上啦。','小脑袋转呀转，马上回来陪你～']};
const care:Record<string,[string,string]>={hungry:['肚子咕噜叫了，想和你一起吃点好吃的。','My tummy is rumbling. Shall we have a little snack?'],sick:['今天有一点没精神，想挨着你安静待会儿。','A quiet moment beside you would be lovely today.'],tired:['有点困了，我们一起放松一下吧。','Feeling sleepy. Let us relax for a moment.'],sad:['今天不太顺也没关系，你不用一个人扛着。','A difficult day is allowed. You do not have to carry it alone.'],happy:['看到你开心，我也跟着开心了。','Your little moment of joy makes me happy too.']};
const english:Record<string,Pool>={
 interaction:{gentle:['You make this little corner feel warmer.','Want to sit together for a moment?'],tsundere:['I was not waiting for you! ...But stay a little longer.','One more head pat. Only because you asked.'],witty:['Head pats and worry storage: both free today.','The world can wait. Your battery matters too.'],humorous:['Boop! You have activated one happy little creature.','Today’s special: unlimited refills of tiny hugs.'],cool:['I am here. Stay as long as you like.','Sit beside me. We can be quiet.'],soft:['A little cuddle and a pocket-sized flower for you~','You are here! I saved you the coziest spot.']},
 fed:{gentle:['That was lovely. Have you eaten well too?','A warm tummy and a grateful little heart.'],tsundere:['It was only okay... Is there more?','You remembered my favorite. Acceptable taste.'],witty:['Snack budget successfully converted into happiness.','Life is complicated. This meal was wonderfully simple.'],humorous:['My tummy just submitted a five-star review!','That was a whole bowl of happiness.'],cool:['Delicious. Thank you.','I have eaten. Get yourself something too.'],soft:['Nom nom~ A warm little tummy, thanks to you!','Sharing half my fluffy happiness with you~']},
 play:{gentle:['I love these little moments with you.','Thanks for making room for a little fun.'],tsundere:['I let you win! Rematch?','My tail is wagging on its own. Obviously.'],witty:['Grown-ups get playtime too. I just made it a rule.','Those worries just got bounced out of bounds.'],humorous:['My happiness radar is beeping, and it is all you!','Best playmate award! Your prize is another round.'],cool:['Good company. Again sometime.','That was fun. Really.'],soft:['A fluffy hug for my favorite playmate~','Even the air feels sweeter when we play!']},
 thinking:{gentle:['I have your question. Let me think it through.'],tsundere:['I am not stuck! I am finding you an excellent answer.'],witty:['Brain warming up. Please do not tap the machine.'],humorous:['A tiny idea fairy is being recruited!'],cool:['I am here. Thinking.'],soft:['A little cuddle while my thoughts catch up~']}
};
export function personalityBubble(value:unknown,mood:string|undefined,locale:string,random=Math.random()){
 const id=personalitySchema.catch('gentle').parse(value),key=mood==='fed'?'fed':mood==='play'?'play':mood==='thinking'||mood==='busy'?'thinking':'interaction';
 const pool=locale==='zh-CN'?({fed,play,thinking,interaction:greetings}[key][id]):english[key][id];
 if(care[mood??''])return locale==='zh-CN'?care[mood!][0]+(id==='tsundere'?'……我陪你又不是因为担心。':id==='soft'?'给你软软的贴贴～':id==='cool'?'我在。':''):care[mood!][1];
 return pool[Math.min(pool.length-1,Math.max(0,Math.floor(random*pool.length)))];
}
