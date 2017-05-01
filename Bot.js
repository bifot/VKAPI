const request = require('tiny_request');
const fs = require('fs');

class Bot {

	constructor(access_tokens) {
		var self = this;
		self.CallbackRegistry = {};
		self.accessTokens = access_tokens;
		self.methodQueue = [];
		self.lastToken = 0;
		self.longPollParams = false;
		self.messageCallBack = Function();
		self.lastServers = {};
		setInterval(function() {
            self.execute();
        }, Math.ceil(1000 / (self.accessTokens.length * 3)) + 50);
	}

	longPoll() {
		var self = this;
		if (!self.longPollParams) {
			self.api('messages.getLongPollServer', {need_pts: 1}, function(data) {
				self.longPollParams = data;
				self.longPoll();
            });
            return;
		}
		let options = {
            url: 'https://' + self.longPollParams.server, 
            query: {
                act: 'a_check',
                key: self.longPollParams.key,
                ts: self.longPollParams.ts,
                wait: 15,
                mode: (128 + 32 + 2),
                version: 1
            }
        };
        request.get(options, function(body, response, error) {
        	if (!error && response.statusCode == 200 && body) {
        		try {
        			body = JSON.parse(body);
        			if (body.pts) {
                        self.longPollParams.pts = body.pts;
                    }
        			if (body.ts) {
        				self.longPollParams.ts = body.ts;
        			} else {
        				self.longPollParams = false;
        			}
        			self.longPoll();
        			if (body.updates && body.updates.length >= 1) {
        				let messages_ids = [];
        				for (var i = body.updates.length - 1; i >= 0; i--) {
        					let update = body.updates[i];
        					if (update[0] != 4) {
                                continue;
                            }
                            if ((update[2] & 2) != 0) {
                                continue;
                            }
                            if (!isEmpty(update[7])) {
                            	messages_ids.push(update[1]);
                            	continue;
                            }
                            self.messageCallBack({
                                user_id: update[3],
                                body: update[6].replace(/<br>/g, ' '),
                                id: update[1],
                                title: update[5],
                                out: 0,
                                read_state: 0,
                                date: update[4]
                            });
        				}
        				if (messages_ids.length == 0) {
        					return;
        				}
        				self.api('messages.getById', {message_ids: messages_ids.join(',')}, function(data) {
        					if (data && data.items) {
        						for (var i = data.items.length - 1; i >= 0; i--) {
        							self.messageCallBack(data.items[i]);
        						}
        					}
        				});
        			}
        		} catch(e) {
        			self.longPollParams = false;
        		    self.longPoll();
        		}
        	} else {
        		self.longPollParams = false;
        		self.longPoll();
        	}
        });
	}

	sendMessage(params) {
        var self = this;
        var to_id = params.peer_id || params.user_id || params.chat_id;
        if (!params.random_id) {
            params.random_id = '7' + time() + '' + rand(1, 999999) + '' + to_id + '' + rand(1, 999999);
        }
        self.api('messages.send', params);
    }

	onMessagesListener(callback) {
		var self = this;
		self.messageCallBack = callback;
		setInterval(function() {
			self.api('messages.getDialogs', {count: 200, unread: 1}, function(data) {
				if (data && data.items.length >= 1) {
					for (var i = data.items.length - 1; i >= 0; i--) {
                        let message = data.items[i].message;
                        if (Math.abs(message.date - time()) >= 5) {
                            self.messageCallBack.push(message);
                        }
                    }
                }
            });
        }, 5000);
		self.longPoll();
	}

	execute() {
		var self = this;
        if (self.methodQueue.length == 0) {
        	return;
        }
        let methods = self.methodQueue.slice(0, 25);
        self.methodQueue = self.methodQueue.slice(25);
        if (methods.length == 0) {
            return;
        }
        let items = [];
        for (var i = methods.length - 1; i >= 0; i--) {
            let method = methods[i];
            items.push('{"callbackName":"' + method.callbackName + '","response":' + method.method + '}');
        }
        if (items.length == 0) {
            return;
        }
        if (self.lastToken >= self.accessTokens.length) {
            self.lastToken = 0;
        } else {
            self.lastToken = self.lastToken + 1;
        }
        var access_token = self.accessTokens[Math.abs(self.lastToken - 1)];
        if (!access_token || access_token == undefined) {
        	self.lastToken = 0;
        	access_token = self.accessTokens[0];
        }
        let code = 'return [' + items.join(',') + '];';
        self.api('execute', {code: code, access_token: access_token}, function(data) {
            if (!data) {
            	for (var i = methods.length - 1; i >= 0; i--) {
            		try {
            			self.CallbackRegistry[methods[i].callbackName](false);
            		} catch(ignored) { } 
            	}
                return;
            }
        	if (data.response) {
        		let errorsMethods = [];
        		let errorsParams = [];
        		for (var i = data.response.length - 1; i >= 0; i--) {
                    let item = data.response[i];
                    if (item.response) {
                    	try {
                    		self.CallbackRegistry[item.callbackName](item.response);
                    	} catch(ignored) { } 
                    } else {
                    	errorsMethods.push(item.callbackName);
                    	errorsParams.push(methods[i].params);
                    }
                }
                if (errorsMethods.length == 0) {
                	return;
                }
                for (var i = errorsMethods.length - 1; i >= 0; i--) {
                	try {
                		let error = data.execute_errors[i];
                		let params = errorsParams[i];
                		let keys = Object.keys(params);
                		delete error.method;
                		error.request_params = [];
                		for (var n = keys.length - 1; n >= 0; n--) {
                			error.request_params.push({key:keys[n], value:params[keys[n]]});
                		}
                		self.CallbackRegistry[errorsMethods[i]]({error: error});
                	} catch(ignored) { } 
                }
        	} else if (data.error) {
        		for (var i = methods.length - 1; i >= 0; i--) {
        			try {
        				let method = methods[i];
        				self.CallbackRegistry[method.callbackName](data);
        			} catch(ignored) { } 
        		}
        	} else {
        		for (var i = methods.length - 1; i >= 0; i--) {
            		try {
            			self.CallbackRegistry[methods[i].callbackName](false);
            		} catch(ignored) { } 
            	}
        	}
        });
	}

	api(method, params, callback, attempt) {
		var self = this;
        method = method || 'execute';
        params = params || {};
        callback = callback || Function();
        attempt = attempt || 0;
        attempt++;
        if (attempt >= 5) {
            callback(false);
            return;
        }
        if (method != 'execute') {
        	let callbackName = 'method' + rand(0, 9999999) + '_' + rand(0, 999999);
        	var isOk = false;
        	let timerId = setTimeout(function() { 
                if (!isOk) {
                    self.api(method, params, callback, attempt);
                    try {
                        delete self.CallbackRegistry[callbackName];
                    } catch(e) { } 
                }
            }, 1200);
        	self.CallbackRegistry[callbackName] = function(data) {
        		callback(data);
                isOk = true;
                clearTimeout(timerId);
                delete self.CallbackRegistry[callbackName];
            };
            self.methodQueue.push({callbackName: callbackName, method: 'API.' + method + '(' + JSON.stringify(params) + ')', params: params});
        	return;
        }
        if (!params.v) {
            params.v = '5.63';
        }
        let options = {
            url: 'https://api.vk.com/method/' + method, 
            form: params, 
            timeout: 3000
        };
        request.post(options, function(body, response, error) {
        	if (!error && response.statusCode == 200 && body) {
        		try {
        			let json = JSON.parse(body);
        			if (json.error || json.execute_errors) {
        				console.log(json);
        			}
        			if (json.response) {
                        callback(json);
                        return;
                    }
                    if (json.error) {
                    	var error = json.error;
                    	switch (error.error_code) {
                            case 1:
                            case 6:
                            case 9:
                            case 10:
                                setTimeout(function() {
                                    self.api(method, params, callback, attempt);
                                }, 800);
                                return;
                            case 5:
                                if (params.access_token) {
                                	console.log('error: ' + params.access_token);
                                } else {
                                	console.log('not access_token');
                                }
                                console.log(params);
                                console.log('_________________________');
                                callback(json);
                                return;
                            default:
                                callback(json);
                                return;
                        }
                    	return;
                    }
        		} catch(e) {
        			setTimeout(function() {
                        self.api(method, params, callback, attempt);
                    }, 800);
        		}
        	} else {
        		setTimeout(function() {
                    self.api(method, params, callback, attempt);
                }, 800);
        	}
        });
	}
}

module.exports = function(access_tokens) {
    return new Bot(access_tokens);
}

function rand(low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

function time() {
    return Math.round(new Date().getTime() / 1000);
}

function isEmpty(obj) {
    if (obj == null) {
        return true;
    }
    if (obj.length && obj.length > 0) {
        return false;
    }
    if (obj.length === 0) {
        return true;
    }
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}
