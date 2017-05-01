# VKAPI

Example method request
------
```javascript
const access_tokens = [
  'token1',
  'token2'
]

const bot = require('./Bot')(access_tokens)

bot.api('groups.getById', { group_ids: 1 }, function(response) {
  console.log(response)
})
```


Send message
------
```javascript
bot.sendMessage({ user_id: 1, message: 'hello' }, (messsage_id) => {
  console.log(messsage_id)
})
```
###### or
```javascript
bot.sendMessage({ user_id: 1, message: 'hello' })
```

Messages Listener
------
```javascript
bot.onMessagesListener(message => {
  console.log(message)
})
```

Upload Docs
------
```javascript
const group_id = 1
const file = 'image.jpg'

docsWallUploadServer(group_id, file, (docs) => {
	console.log(docs) // Docs Object
})
```
