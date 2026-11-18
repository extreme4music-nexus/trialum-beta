/* Pure JS offline GIF89a encoder — 256-color RGB332 palette + standard LZW. */
(function(root){
'use strict';
function gifEncode(frames,width,height,delayCs=8){
 if(!Array.isArray(frames)||!frames.length||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1024||height>1024)throw Error('Invalid GIF frames');
 const bytes=[],u8=x=>bytes.push(x&255),u16=x=>{u8(x);u8(x>>8)},ascii=s=>{for(let i=0;i<s.length;i++)u8(s.charCodeAt(i))};
 ascii('GIF89a');u16(width);u16(height);u8(0xf7);u8(0);u8(0);
 for(let i=0;i<256;i++){u8(((i>>5)&7)*255/7);u8(((i>>2)&7)*255/7);u8((i&3)*255/3);}
 // Netscape infinite-loop application extension.
 u8(0x21);u8(0xff);u8(11);ascii('NETSCAPE2.0');u8(3);u8(1);u16(0);u8(0);
 const delay=Math.max(3,Math.min(300,Math.round(delayCs)));
 for(const frame of frames){
  if(!frame||frame.length<width*height*4)throw Error('Frame dimensions do not match GIF');
  // Graphic control: no transparency, 1 frame delay.
  u8(0x21);u8(0xf9);u8(4);u8(4);u16(delay);u8(0);u8(0);
  u8(0x2c);u16(0);u16(0);u16(width);u16(height);u8(0);
  u8(8); // 8-bit LZW minimum code size.
  let bits=0,bitcount=0,blocks=[],block=[];
  function flush(v){while(bitcount>=8){block.push(bits&255);bits=Math.floor(bits/256);bitcount-=8;if(block.length===255){blocks.push(block);block=[];}}}
  function emit(code,size){bits+=code*Math.pow(2,bitcount);bitcount+=size;flush();}
  let table=new Map(),next=258,codeSize=9,threshold=512;
  const reset=()=>{table=new Map();next=258;codeSize=9;threshold=512;};
  emit(256,codeSize);
  let prev=0,hasPrev=false;
  for(let p=0;p<width*height;p++){
   const pos=p*4,r=frame[pos],g=frame[pos+1],b=frame[pos+2];
   const index=((r>>5)<<5)|((g>>5)<<2)|(b>>6);
   if(!hasPrev){prev=index;hasPrev=true;continue;}
   const key=prev*256+index;
   const match=table.get(key);
   if(match!==undefined){prev=match;continue;}
   emit(prev,codeSize);
   if(next<4096){
    table.set(key,next++);
    if(next===threshold && codeSize<12){codeSize++;threshold*=2;}
   }else{emit(256,codeSize);reset();}
   prev=index;
  }
  if(hasPrev)emit(prev,codeSize);
  emit(257,codeSize);
  if(bitcount>0){block.push(bits&255);if(block.length===255){blocks.push(block);block=[];}}
  if(block.length)blocks.push(block);
  for(const chunk of blocks){u8(chunk.length);for(const x of chunk)u8(x)}
  u8(0);
 }
 u8(0x3b);
 return new Uint8Array(bytes);
}
root.TrialumGif={encode:gifEncode};
if(typeof module==='object'&&module.exports)module.exports={encode:gifEncode};
})(typeof globalThis!=='undefined'?globalThis:this);
