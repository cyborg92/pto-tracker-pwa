
# Follow along and have a PWA build by the end

## What we are going to do

Use the latest web technologies to turn the application into a PWA

## Checkout the branch `workshop` and start the app

```

git checkout workshop
npm start

```


## Understand the App shell 

## Using service workers to pre cache the App shell

Register the service worker if the browser supports

```

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then(function() { 
        console.log('Service Worker Registered'); 
      });
  }
  
```

## Add metadata for the browser to recognise the PWA

## Add manifest file and allow the user to add it on the home screen

## Enabling push notifications

## Sending push notifications
