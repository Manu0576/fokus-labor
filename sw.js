const C="fokuslabor-shell";
self.addEventListener("install",function(e){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET")return;
  if(new URL(req.url).origin!==location.origin)return;
  e.respondWith(
    fetch(req).then(function(res){
      var copy=res.clone();
      caches.open(C).then(function(c){c.put(req,copy)});
      return res;
    }).catch(function(){return caches.match(req)})
  );
});
