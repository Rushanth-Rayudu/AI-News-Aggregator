function decodeFeedText(value) {
 const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',rsquo:'\u2019',lsquo:'\u2018',rdquo:'\u201d',ldquo:'\u201c',ndash:'\u2013',mdash:'\u2014'};
 let text=String(value||'');
 for(let i=0;i<2;i++) text=text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(raw,key)=>{
  if(key[0]!=='#')return named[key.toLowerCase()]??raw;
  const hex=key[1].toLowerCase()==='x',n=parseInt(key.slice(hex?2:1),hex?16:10);
  return n>0&&n<=0x10ffff?String.fromCodePoint(n):raw;
 });
 return text;
}
module.exports={decodeFeedText};
