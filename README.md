# VKAPI

Example method request 
------
```
const access_tokens = [
    'token1',
    'token2'
];
const Bot = require('./Bot.js')(access_tokens);
Bot.api('groups.getById', {group_ids: 1}, function(response) {
    console.log(response);
});
```


Send message
------
```
Bot.sendMessage({user_id: 1, message: 'hello'}, function(messsage_id) {
    console.log(messsage_id);
});
```
###### or
```
Bot.sendMessage({user_id: 1, message: 'hello'});
```

Messages Listener
------
```
Bot.onMessagesListener(function(message) {
    console.log(message);
});
```

Upload Docs
------
```
let group_id = 1;
let file = 'image.jpg';
docsWallUploadServer(group_id, file, function(docs) {
	console.log(docs) // Docs Object 
});
```
