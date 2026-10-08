// Legacy runtime entry retains query; browser also retains a pre-existing #delivery fragment.
// Deliberately never serves the historical public copy of the game.
export function onRequest({request}) {
  if(request.method!=='GET' && request.method!=='HEAD')return new Response(null,{status:405,headers:{'Cache-Control':'no-store'}});
  const url=new URL(request.url);
  return new Response(null,{status:307,headers:{Location:'/lab/'+url.search,'Cache-Control':'no-store'}});
}
