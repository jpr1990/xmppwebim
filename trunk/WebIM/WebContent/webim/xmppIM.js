// JavaScript Document
(function($) {
	IS_DEBUG = false;
	thisComponent = false;
	$.fn.xmppIM = function(opts) {
		return this.each(function() {
			if(!thisComponent){
				var conf = $.extend( {}, opts);			
				thisComponent = xmppIM_component();
				thisComponent.init(this, conf);
			}
		});
	};
	
	$.xmppIM = {
			/**
			 * 默认配置
			 */
			defaults : {
				service : '/http-bind/',
				path : 'webim',
				resource: 'webim',
				domain: 'viking',
				workspaceClass : 'xmppIMPanel',
				dateFormat: 'hh:mm:ss',
				title: 'WEB IM',
				defaultGroupId : 'xmppIM_defaultContact_Group',
				userId:'',
				password:'',
				presence:{
					chat:'M我吧', //在线并有兴趣聊天	        
			        available:'空闲', //在线(默认状态)
			        away:'离开',//离开
			        xa:'离开',//长时间离开
			        dnd:'忙碌中'//请勿打扰
				}
			},
			/**
			 * 在线类型，对应Presence包的show节点
			 */
			PresenceMode:{
				chat:'chat', //在线并有兴趣聊天	        
		        available:'available', //在线(默认状态)
		        away:'away',//离开
		        xa:'xa',//长时间离开
		        dnd:'dnd'//请勿打扰
			},
			/**
			 * Presence包的类型
			 */
			PresenceType:{
				available:'available',//在线(默认值)
		        unavailable:'unavailable',//离线
		        subscribe:'subscribe',//请求订阅接受者的在线状态
		        unsubscribe:'unsubscribe',//取消订阅接受者的在线状态
		        subscribed:'subscribed',//同意发送者订阅接受者的在线状态
		        unsubscribed:'unsubscribed',//拒绝发送者订阅接受者的在线状态
		        error:'error'//出错,presence包中包含一个error子标签描述错误
			},
			/**
			 * 联系人状态订阅类型，对应Roster中item的subscription属性
			 */
			RosterItemType:{
		        none:'none',//双方都不可订阅
		        to:'to',//订阅了该item指定用户的在线状态
		        from:'from',//该item指定用户订阅了我的在线状态
		        both:'both',//双方都订阅了对方的状态
		        remove:'remove'//从联系人中删除
			},
			/**
			 * 对这个item当前的请求状态，对应Roster中item的ask属性
			 */
			RosterItemStatus:{
				subscribe:'subscribe',//请求订阅
				unsubscribe:'unsubscribe'//请求取消订阅
			}
	};	
	
	$.xmppIM.component = function(){
		return thisComponent;
	};
	
	/**
	 * 一些工具函数
	 */
	$.xmppIM.util = {
			/**
			 * 格式化时间
			 */
			dateFormat : function(date, format)  
			{  
			   var o = {  
			     "M+" : date.getMonth()+1, //月
			     "d+" : date.getDate(),    //日  
			     "h+" : date.getHours(),   //时  
			     "m+" : date.getMinutes(), //分  
			     "s+" : date.getSeconds(), //秒
			     "q+" : Math.floor((date.getMonth()+3)/3), //季  
			     "S" : date.getMilliseconds() //毫秒  
			   };  
			   if(/(y+)/.test(format)){
				   format=format.replace(RegExp.$1,(this.getFullYear()+"").substr(4 - RegExp.$1.length));
			   }
			   for(var k in o){
				   if(new RegExp("("+ k +")").test(format)){  
					   format = format.replace(RegExp.$1,RegExp.$1.length==1 ? o[k] : ("00"+ o[k]).substr((""+ o[k]).length));
				   }
			   }
			   return format;  
			},
			/**
			 * 地址里的特殊字符转义
			 */
			escapeAddress : function(XMPPAddress){
				if (XMPPAddress == null) {
		            return null;
		        }
				return XMPPAddress.replace(/@/, '\\@').replace(/\//g, '\\/').replace(/\./g, '\\.');
			},
			/**
			 * 把字符串转换成整数，如果转换失败则返回0
			 */
			parseInt : function(str){
				var n = parseInt(str);
				return isNaN(n) ? 0 : n;
			},
			/**
			 * 检查是否合法的jid
			 */
			isValidJID : function(jid){
				return /^\w+@\S+$/.test(jid);
			},
			showMessage : function(msg,title){
				$('#xmppIM_sysInfo').html(msg).dialog({
					'title' : title ? title : '提示',
					buttons : {
						'确定' : function(){
							$('#xmppIM_sysInfo').dialog('close');
						}
					}
				});
			},
			/**
			 * 格式化字符串
			 * var a = "I Love {0}, and You Love {1},Where are {0}! {4}";
			 * format(a,"You","Me")
			 */
			format : function() {
			    if( arguments.length == 0 )
			        return null;
			    var str = arguments[0];
			    for(var i=1;i<arguments.length;i++) {
			        var re = new RegExp('\\{' + (i-1) + '\\}','gm');
			        str = str.replace(re, arguments[i]);
			    }
			    return str;
			}
	};
	
	$.xmppIM.message = {
			
	};
	
	function xmppIM_component(elem, conf) {
		var container = $(elem);
		var setting = $.extend( {}, $.xmppIM.defaults);		
		var imManager = $.xmppIM.manager;
		var rosterManager;
		var presenceManager;
		var searchUserDialog;
		var chatManager;
		var connection;
		return {
			//connection : {},
			//container : {},
			//setting : $.extend( {}, $.xmppIM.defaults),
			//chatRoomDlgList : {},//保存全部聊天对话框
			/**
			 * {
					presence:{jid:{resource:{type, status, priority, mode, language},...}},
					groups:{goupsName:{jid:{entriy},jid:{entriy},...},
					entries:{jid:{jid, nickName, type, status, groups:[name,name,...]}}
				}
			 */
			//roster : {presence:{}, groups:{}, entries:{}}, //保存用户的联系人列表，还包括分组列表和在线状态
			//hasInit: false,//是否已初始化
			/**
			 * [
			 * 	{item, info}
			 * ]
			 */
			discoverItems:{},
			//defaultGroupName:'',//默认分组的名称
			userSearchService:[],//提供的搜索用户服务{'jid':jid, 'name':$this.attr('name')}
			//searchUserDialog:{}, //搜索并添加好友的对话框
			/**
			 * 初始化
			 */
			init : function(elem, conf) {
				container = $(elem);
				setting = $.extend(true, {}, setting, conf);
				connection = new Strophe.Connection(setting.service);
				container.addClass(setting.workspaceClass);
				this.initNamespace();
				this.showLoginDlg();
				//debug
				if(IS_DEBUG){
					jQuery('<div/>', {
						id:'logger',
						css:{
							position:'absolute',width:'100%',height:'300px',bottom:'0px',
							overflowY:'auto',background:'#000000',color:'#FFFFFF',zIndex:'999'
						}
					}).appendTo(jQuery('body'));
					connection.rawInput = rawInput;
				    connection.rawOutput = rawOutput;
				}
			},
			/**
			 * 初始化namespace
			 */
			initNamespace : function(){
				Strophe.addNamespace('VCARD_TEMP', 'vcard-temp');
				Strophe.addNamespace('SEARCH_USER', 'jabber:iq:search');
				Strophe.addNamespace('DATA_FORM', 'jabber:x:data');
			},
			/**
			 * 加载并显示登录界面
			 */
			showLoginDlg : function() {
				container.load(setting.path + '/html/login.html', function(){
					$('#xmppIM_btnLogin').button().click(function(){
						var userId = thisComponent.makeJID($('#xmppIM_login_userId').val());
						var password = $('#xmppIM_login_password').val();
						setting.userId = userId;
						setting.password = password;
						connection.connect(userId, password, thisComponent.onConnect);
					});
				});
				container.dialog({
					height : 500,
					width : 260,
					title : setting.title,
					open: function(event, ui){
						//event.target.find('#xmppIM_btnLogin').
					}
				});
			},
			/**
			 * 连接状态回调函数
			 */
			onConnect : function(status){
				if (status == Strophe.Status.CONNECTING) {
					// 登录中
				} else if (status == Strophe.Status.CONNFAIL) {
					// 登陆失败
				} else if (status == Strophe.Status.DISCONNECTING) {
					// 正在断开连接
				} else if (status == Strophe.Status.DISCONNECTED) {
					// 断开连接
				} else if (status == Strophe.Status.CONNECTED) {
					// 登陆成功
					container.dialog('option', 'title', setting.title + ' - ' + setting.userId);
					//初始化
					thisComponent.attachHandler.call(thisComponent);
					thisComponent.initWorkspace.call(thisComponent);
					$(window).unload(function() { 
						connection.disconnect();
					});
				}else if(status == Strophe.Status.AUTHFAIL){
					connection.disconnect();
				}else if(status == Strophe.Status.ATTACHED){
				}else if(status == Strophe.Status.ERROR){
					connection.disconnect();
				}
			},
			/**
			 * 登录成功后执行，设置数据包处理函数
			 */
			attachHandler : function(){
				//this.connection
				//this.connection.addHandler(this.onMessage, null, 'message', 'chat', null, null);
				this.connection.addHandler(this.onJabberRoster, Strophe.NS.ROSTER, 'iq', null, null, null);
				this.connection.addHandler(this.onDiscoverItems, Strophe.NS.DISCO_ITEMS, 'iq', null, null, null);
				//this.connection.addHandler(this.onPresence, null, 'presence', null, null, null);
			},
			/**
			 * 登陆成功后初始化IM界面
			 */
			initWorkspace : function(){
				container.load(setting.path + '/html/workspace.html', function(){
					setting['defaultGroupName'] = $('#'+setting.defaultGroupId)
													.find('span[type="xmppIM_contactGroup_Header"]:eq(0)')
													.text();					
					$('#xmppIM_contactPanel').tabs();
					//查询服务器提供的服务
					var queryDiscoverItem = $iq({type: 'get', to: setting.domain}).c('query', {xmlns: Strophe.NS.DISCO_ITEMS});
					connection.send(queryDiscoverItem.tree());
					//获取联系人
					var queryRoster = $iq({type: 'get'}).c('query', {xmlns: Strophe.NS.ROSTER});
					connection.send(queryRoster.tree());
					//聊天对话框的发送按钮事件
					$('#xmppIM_btnSendMsg').button().live('click', function(){
						thisComponent.sendMessage($(this));
					});
					//输入框按回车事件
					$('#xmppIM_msgContent').live('keypress', function(event){
						if (event.ctrlKey && event.keyCode == '13') {
							var $btn = $(this).parents('div.inputArea').find('#xmppIM_btnSendMsg');
							thisComponent.sendMessage($btn);
							return false;
						}
					});
					thisComponent.initUpdatePresenceMenu();
					thisComponent.initSearchBar();
					thisComponent.initToolbar();					
					//发送在线的Presence
					presenceManager.sendPresence($.xmppIM.PresenceMode.available, '8');
				});
			},
			/**
			 * 初始化更新在线状态的菜单
			 */
			initUpdatePresenceMenu : function(){
				$('#xmppIM_updatePresence').contextMenu('xmppIM_presenceMenu', {
					bindings : {
						'available' : function(t) {
							presenceManager.sendPresence($.xmppIM.PresenceMode.available, '8');
						},
						'chat' : function(t) {
							presenceManager.sendPresence($.xmppIM.PresenceMode.chat, '10');
						},
						'away' : function(t) {
							presenceManager.sendPresence($.xmppIM.PresenceMode.away, '4');
						},
						'dnd' : function(t) {
							presenceManager.sendPresence($.xmppIM.PresenceMode.dnd, '6');
						}
					},
					triggerEvent : 'click',
					eventPosX:function(){
						return $('#xmppIM_updatePresence').offset().left;
					},
					eventPosY:function(){
						return $('#xmppIM_updatePresence').offset().top + 20;
					}
				});
			},
			/**
			 * 初始化搜索栏
			 */
			initSearchBar : function(){
				$('#xmppIM_searchInput').autocomplete({
					source: function(request, response) {
						var maxResult = 6;
						console.log(request, response, $.ui.autocomplete.escapeRegex(request.term));
						var result = [];//[{label,value}]
						var matcher = new RegExp('^'+$.ui.autocomplete.escapeRegex(request.term), "i");
						$.each(rosterManager.getEntries(),function(jid, entry){
							if(matcher.test(entry.nickName)){
								result.push({'label':entry.nickName+'('+jid+')','value':entry.nickName,'jid':jid});
							}
							if(result.size >= maxResult){
								return false;
							}
						});
						if(result.length < maxResult){
							$.each(rosterManager.getEntries(),function(jid, entry){
								if(matcher.test(jid)){
									result.push({'label':entry.nickName+'('+jid+')','value':entry.nickName,'jid':jid});
								}
								if(result.size >= maxResult){
									return false;
								}
							});
						}
						response(result);
					},					
					select: function(event, ui) {
						var presence = presenceManager.getPresence(ui.item.jid);//不带资源的jid
						if(presence && presence.count > 0){
							var target, priority = '';
							$.each(presence, function(res, p){
								if($.xmppIM.util.parseInt(p.priority) >= $.xmppIM.util.parseInt(priority)){
									target = res;
									priority = p.priority;
								}
							});
							console.log('聊天：',ui.item.jid+'/'+target);
							thisComponent.createOne2OneChat(ui.item.jid+'/'+target);
						}else{
							thisComponent.createOne2OneChat(ui.item.jid);
						}
					}
				});
			},
			/**
			 * 初始化工具栏
			 */
			initToolbar : function(){
				$('#xmppIM_cmdButton  span').mouseover(function(){
					$(this).parent().addClass('ui-state-hover');
				}).mouseout(function(){
					$(this).parent().removeClass('ui-state-hover');
				});
				$('#xmppIM_addContact').click(function(){					
					thisComponent.searchUserDialog.showDialog();
				});
			},			
			/**
			 * 解析服务器提供的服务
			 */
			onDiscoverItems : function(iq){
				$(iq).find('item').each(function(){
					var $this = $(this);
					var obj = {item:$this, info:{}};
					var jid = $this.attr('jid');
					thisComponent.discoverItems[jid] = obj;
					var queryInfo = $iq({type: 'get', to: jid}).c('query', {xmlns: Strophe.NS.DISCO_INFO});
					connection.sendIQ(queryInfo, function(iq){
						thisComponent.discoverItems[jid].info = $(iq);
						//检查是否搜索用户的服务
						if($(iq).find('feature[var="'+Strophe.NS.SEARCH_USER+'"]').length > 0){
							$(iq).find('identity[category="directory"][type="user"]').each(function(){
								thisComponent.userSearchService.push({'jid':jid, 'name':$this.attr('name')});
								//初始化搜索服务的下拉
								$('<option/>', {
									value:jid,
									text:$this.attr('name')
								}).appendTo($('#xmppIM_searchService'));
							});
						}
					});
				});
			}
		};
	};
	
	$.xmppIM.manager = (function(){
		var searchUserDialog = null;
		var rosterManager = null;
		var presenceManager = null;
		var chatManager = null;
		var param = {};
		return {
			/**
			 * 初始化，必须执行该方法初始化
			 */
			init : function(pSetting, pContainer, pConnection){
				param['setting'] = pSetting;
				param['container'] = pContainer;
				param['connection'] = pConnection;
			},
			getRosterManager : function(){
				if(rosterManager == null){
					rosterManager = RosterManager(param);
				}
				return rosterManager;
			},
			getSearchUserDialog:function(){
				if(searchUserDialog == null){
					searchUserDialog = SearchUserDialog(param);
				}
				return searchUserDialog;
			},
			getPresenceManager : function(){
				if(presenceManager == null){
					presenceManager = PresenceManager(param);
				}
				return presenceManager;
			},
			getChatManager : function(){
				if(chatManager == null){
					chatManager = ChatManager(param);
				}
				return chatManager;
			}
		};
	})();
	
	/**
	 * 聊天管理器
	 */
	function ChatManager(param){
		if(!param){
			throw 'ChatManager：缺少参数param';
		}
		var chatRoomDlgList = {};//保存全部聊天对话框
		var setting = param['setting'];
		var rosterManager = $.xmppIM.manager.getRosterManager();
		var connection = param['connection'];
		
		//返回ChatManager对象
		var chatManager = {
			/**
			 * 创建一对一的聊天对话，
			 * 返回新建的对话框(jQuery)对象
			 */
			createOne2OneChat : function(jid){
				//生成聊天对话框
				if(chatRoomDlgList[jid]){
					chatRoomDlgList[jid].dialog('open').dialog( "moveToTop" );
				}else{
					var nickName = rosterManager.getNickName(jid);
					var $chatRoomDlg = $('#xmppIM_chatDialog').clone(true).attr('id', 'xmppIM_chatDialog_'+jid).appendTo($('#xmppIM_chatDialog'));
					$('#xmppIM_targetJID', $chatRoomDlg).val(jid);
					$chatRoomDlg.find('div.userName').text(nickName);
					chatRoomDlgList[jid] = $chatRoomDlg;
					$chatRoomDlg.dialog({
						height : 340,
						width : 420,
						title : '与 '+nickName+' 聊天',
						resizable: false
					});
				}
				return chatRoomDlgList[jid];
			},
			/**
			 * 发送短消息
			 */
			sendMessage : function($sendBtn){
				var $dlg = $sendBtn.parents('div.xmppIM_chatDialog');
				var $text = $('#xmppIM_msgContent', $dlg);
				var content = $text.val();
				if(content != ''){
					var targetJID = $sendBtn.siblings('#xmppIM_targetJID').val();
					$text.val('');
					var msg = $msg({type:'chat', from:setting.userId, to:targetJID})
						.cnode(Strophe.xmlElement('body','',content));
					var nickName = setting.userId;
					connection.send(msg.tree());
					this.insertChatLog($dlg, nickName, new Date(), content, 'itemHeaderTo');
				}
			},
			/**
			 * 处理收到的短消息
			 */
			onMessage : function(msg){
				var $msg = $(msg);
				var from = $msg.attr('from');
				var content = $msg.children('body').length > 0 ? $msg.children('body').text() : '';
				var $dlg = createOne2OneChat(from);
				var $chatLog = $dlg.find('div[type="template"]').clone().removeAttr('type');
				var nickName = rosterManager.getNickName(from);
				this.insertChatLog($dlg, nickName, new Date(), content, 'itemHeaderFrom');
				return true;
			},
			/**
			 * 插入一条聊天记录到对话框里
			 */
			insertChatLog : function($dlg, nickName, date, content, className){
				var $chatLog = $dlg.find('div[type="template"]').clone().removeAttr('type');
				$chatLog.find('span.logUserName').text(nickName);
				$chatLog.find('span.logTime').text($.xmppIM.util.dateFormat(new Date, setting.dateFormat));
				$chatLog.find('div.content').text(content);
				$chatLog.find('div[type="logItemHeader"]').addClass(className);
				$chatLog.appendTo($dlg.find('div.chatLog')).show();
			}
		};
		//初始化
		connection.addHandler(chatManager.onMessage, null, 'message', 'chat', null, null);
		return chatManager;
	};
	
	/**
	 * 在线状态管理器
	 */
	function PresenceManager(param){
		//presence:{jid:{count,resource:{type, status, priority, mode, language},...}}
		var presence = {};
		var setting = param['setting'];
		var rosterManager = $.xmppIM.manager.getRosterManager();
		var connection = param['connection'];
		//定义public方法
		var presenceManager = {
			/**
			 * 获取指定jid的所有presence或某一个资源的presence，第二个参数可选
			 */
			getPresence : function(jid, res){
				var barejid = Strophe.getBareJidFromJid(jid);
				return res ? roster.presence[barejid][res] : roster.presence[barejid];
			},
			/**
			 * 更新一个presence
			 */
			setPresence : function(jid, res, pres){
				var barejid = Strophe.getBareJidFromJid(jid);
				if(!presence[barejid]){
					presence[barejid] = {count:0};
				}
				presence[barejid][res] = pres;
				if(!presence[barejid].count){
					presence[barejid].count = 0;
				}
			},
			/**
			 * 删除presence，第二个参数可选，如果指定了资源则只删除该资源的res
			 */
			removePresence : function(jid, res){
				var barejid = Strophe.getBareJidFromJid(jid);
				if(res){
					delete presence[barejid][res];
					presence[barejid].count --;
				}else{
					delete presence[barejid];
				}
			},
			/**
			 * 发送presence包，更新当前用户的在线状态
			 */
			sendPresence : function(mode, priority){
				var status = setting.presence[mode];
				if(mode == $.xmppIM.PresenceMode.available){
					connection.send($pres()
							.cnode(Strophe.xmlElement('status','',setting.presence[mode])).up()
							.cnode(Strophe.xmlElement('priority','',priority))
							.tree());
				}else{
					connection.send($pres()
							.cnode(Strophe.xmlElement('show','',$.xmppIM.PresenceMode[mode])).up()
							.cnode(Strophe.xmlElement('priority','',priority)).up()
							.cnode(Strophe.xmlElement('status','',setting.presence[mode]))
							.tree());
				}
				$('#xmppIM_updatePresence > span:eq(0)').text(status);
			},
			/**
			 * 发送同意加好友请求的presence
			 */
			applySubscribe : function(tojid){
				var pres = $pres({to:tojid, type:$.xmppIM.PresenceType.subscribed});
				connection.send(pres.tree());
			}
		};
		//定义private方法
		/**
		 * 处理presence
		 */
		var onPresence = function(p){
			var $p = $(p);
			var presence = {type:'', status:'', priority:'', mode:'', language:''};
			presence.type = $p.attr('type');
			if(presence.type == undefined || presence.type==''){
				presence.type = $.xmppIM.PresenceType.available;
			}
			var from = $p.attr('from');
			var resource = Strophe.getResourceFromJid(from);
			var address = Strophe.getBareJidFromJid(from);
//			if(!thisComponent.roster.entries[address]){
//				return;//忽略不在联系人中的jid
//			}
			resource == '' ? 'empty' : resource;
			if(presence.type == $.xmppIM.PresenceType.available){//上线
				//解析presence
				var status = $p.children('status');
				presence.status = status.length > 0 ? status.text() : '';
				var priority = $p.children('priority');
				presence.priority = priority.length > 0 ? priority.text() : '';
				var mode = $p.children('show');
				presence.mode = mode.length > 0 ? mode.text() : $.xmppIM.PresenceMode.available;
				var language = $p.attr('xml:lang');
				presence.language = language ? language : '';
				//按资源存放
//				if(!thisComponent.roster.presence[address]){
//					thisComponent.roster.presence[address] = {};
//				}
//				thisComponent.roster.presence[address][resource] = presence;
//				if(!thisComponent.roster.presence[address].count){
//					thisComponent.roster.presence[address].count = 0;
//				}
				presenceManager.setPresence(address, resource, presence);
				//更新联系人列表
				var $newItem = $('#'+$.xmppIM.util.escapeAddress(from));
				if($('#'+$.xmppIM.util.escapeAddress(from)).length == 0){//如果该jid的li不存在才创建
					//TODO cout++应该放进setPresence中
					presenceManager.getPresence(address).count ++;//这需要改
					var groups = rosterManager.getUserGroups(address);//thisComponent.roster.entries[address].groups;
					$.each(groups, function(i, groupName){
						var groupId = rosterManager.getGroupId(groupName);
						var $oldItem = $('#'+$.xmppIM.util.escapeAddress(address), $('#'+$.xmppIM.util.escapeAddress(groupId)));
						console.log($oldItem.length, groupId, address);
						//复制一个
						$newItem = $oldItem.clone(true).addClass('online').attr('id', from)
										.attr('res', resource).prependTo($oldItem.parent()).attr('resmark',false).show();							
						$oldItem.hide();
					});
				}
				$newItem.children('span').text(rosterManager.getUserStatusText(presence));
				if(presenceManager.getPresence(address).count > 1){
					//resmark属性标识是否添加了资源提示
					$('li[id^="'+address+'"][resmark="false"] > a').text(function(index, text){
						$(this).parent().attr('resmark',true);
						return text + ' - ' + $(this).parent().attr('res');
					});
				}
			}else if(presence.type == $.xmppIM.PresenceType.unavailable){//离线
				//delete thisComponent.roster.presence[address][resource];
				presenceManager.removePresence(address, resource);
				//rosterManager.getPresence(address).count--;
				$('#'+$.xmppIM.util.escapeAddress(from)+'[res="'+resource+'"]').remove();
				if(presenceManager.getPresence(address).count == 0){
					//全部资源都已离线
					$('#'+$.xmppIM.util.escapeAddress(address)).show();
				}else if(presenceManager.getPresence(address).count == 1){
					//删除所有资源提示
					$('li[id^="'+address+'"][resmark="true"] > a').text(function(index, text){
						$(this).parent().attr('resmark',false);
						return text.substring(0, text.indexOf('-'));
					});
				}
			}else if(presence.type == $.xmppIM.PresenceType.subscribe){//添加好友的请求
				var entry = rosterManager.getEntry(address);
				//如果已加对方为好友，则自动同意对方的请求
				if(entry){
					if(entry.type == $.xmppIM.RosterItemType.to){
						presenceManager.applySubscribe(from);
					}
				}else{
					$('#xmppIM_confirmSubscribe').dialog({
						
					});
				}
			}
			return true;
		};		
		//初始化
		connection.addHandler(onPresence, null, 'presence', null, null, null);
		return presenceManager;
	};
	
	/**
	 * 管理联系人信息
	 */
	function RosterManager(param){
		if(!param){
			throw 'RosterManager：缺少参数pSetting';
		}
		var setting = param['setting'];
		var connection = param['connection'];
		var presenceManager = $.xmppIM.manager.getPresenceManager();
		var chatManager = $.xmppIM.manager.getChatManager();
		/**
		 * {
				groups:{goupsName:{jid:{entriy},jid:{entriy},...},
				entries:{jid:{jid, nickName, type, status, groups:[name,name,...]}}
			}
		 */
		var roster = {groups:{}, entries:{}}; //保存用户的联系人列表，还包括分组列表和在线状态	
		var hasInit = false;
		var rosterManager = {
			makeJID : function(userId, noRes){
				if(noRes){
					return userId + "@" + setting.domain;
				}else{
					return userId + "@" + setting.domain + "/" + setting.resource;
				}
			},
			/**
			 * 获取昵称
			 */
			getNickName : function(jid){
				var entry = this.getEntry(jid);
				if(entry){
					return entry.nickName;
				}else{
					return jid;
				}
			},
			/**
			 * 获取联系人信息
			 * return {jid, nickName, type, status, groups:[name,name,...]}
			 */
			getEntry: function(jid){
				return roster.entries[Strophe.getBareJidFromJid(jid)];
			},
			/**
			 * 是否存在该联系人
			 */
			existEntry : function(jid){
				return this.getEntry(jid) ? true : false;
			},
			/**
			 * 获取全部联系人
			 * return 联系人数组
			 */
			getEntries : function(){
				return roster.entries;
			},
			/**
			 * 增加一个联系人信息
			 */
			addEntry : function(jid, entry){
				roster.entries[jid] = entry;
			},
			/**
			 * 删除一个联系人信息
			 */
			removeEntry : function(jid){
				$.each(getEntry(jid).groups, function(i, name){
					delete roster.groups[name][jid];
				});
				delete roster.entries[jid];
			},
			/**
			 * 增加或修改一个group
			 */
			addGroup : function(groupName, entry){
				entry.groups.push(groupName);
				var groups;
				if(roster.groups[groupName]){
					groups = roster.groups[groupName];
				}else{
					groups = {};
					roster.groups[groupName] = groups;
				}
				groups['name'] = groupName;
				groups[item.jid] = entry;
			},
			/**
			 * 获取全部分组列表
			 */
			getAllGroups : function(){
				return roster.groups;
			},
			/**
			 * 获取一个用户所属的分组
			 */
			getUserGroups : function(jid){
				return getEntry(jid).groups;
			},
			/**
			 * 根据分组名获取分组的id
			 */
			getGroupId : function(groupName){
				return (groupName == setting.defaultGroupName) ? setting.defaultGroupId : groupName;
			},
			/**
			 * 获取在线状态的文字描述
			 */
			getUserStatusText : function(presence){
				return presence.status == '' ? setting.presence[presence.mode] : presence.status;
			}
		};
		/**
		 * private
		 * 处理联系人列表
		 * <iq xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams" type="result" id="sd113" to="small@viking/潘迪安">
		 * 	<query xmlns="jabber:iq:roster">
		 * 		<item jid="abc@viking" subscription="both"/>
		 * 		<item jid="cody@viking" subscription="both"><group>我的好友</group></item>
		 * 		<item jid="admin@viking-pc" subscription="both"/>
		 * 		<item jid="lxp@viking" subscription="both"><group>我的好友</group></item>
		 * </query></iq>
		 */
		var onJabberRoster = function(iq){
			var newRosters = [];
			$(iq).find('item').each(function(){
				var $this = $(this);
				var item = {jid:'', nickName:'', type:'', status:'', groups:[]};
				item.jid = $this.attr('jid');
				item.nickName = $this.attr('name') ? $this.attr('name') : item.jid;
				item.type = $this.attr('subscription');
				item.status = $this.attr('ask');
				//保存分组
				//var group = thisComponent.roster.groups[item.jid] ? thisComponent.roster.groups[item.jid] : {};
				var $group = $this.children('group');
				if($group.length > 0){
					$group.each(function(){
						var groupName = $(this).text();
						rosterManager.addGroup(groupName, item);
					});
				}else{
					//如果没有分组则放到默认分组里
					rosterManager.addGroup(setting.defaultGroupName, item);
				}
				rosterManager.addEntry(item.jid, item);
				newRosters.push(item);
			});
			createRosterTree(newRosters);
			return true;
		};
		/**
		 * private
		 * 创建联系人列表
		 */
		var createRosterTree = function(entries){
			var groupTemplate = $('#'+setting.defaultGroupId).clone();//先复制一个用作模板
			console.log(entries);
			$.each(entries, function(i, item){				
				//在联系人列表中删除联系人
				if(item.type == $.xmppIM.RosterItemType.remove){
					//$.xmppIM.util.showMessage(item.nickName'')
					//delete thisComponent.roster.presence[item.jid];
					presenceManager.removePresence(item.jid);
//					$.each(rosterManager.getEntry(item.jid).groups, function(i, name){
//						delete thisComponent.roster.groups[name][item.jid];
//					});
//					delete thisComponent.roster.entries[item.jid];
					rosterManager.removeEntry(item.jid);
					$('li[id^="'+$.xmppIM.util.escapeAddress(item.jid)+'"]').remove();
				}else{
					//创建group
					$.each(item.groups, function(i, name){
						var groupId = rosterManager.getGroupId(name);
						var $group = $('#'+groupId);
						if($group.length == 0 && name != setting.defaultGroupName){//检查是否已建了该分组
							$group = groupTemplate.clone().attr('id', name)
								.prependTo('#xmppIM_contactList')
								.find('span[type="xmppIM_contactGroup_Header"] > a')
								.text(name).end();
						}
						var targetGroup = $group.find('ul:eq(0)');
						//创建联系人
						createContactItem(targetGroup, item);
						
					});//end each
				}
			});
			//初始化时设置事件
			if(!hasInit){
				//设置分组头点击事件
				$('#xmppIM_contactList').find('span[type="xmppIM_contactGroup_Header"]').live('click',function(){
					$(this).siblings('ul').toggle();
					if($(this).children('b').hasClass('ui-icon-triangle-1-e')){
						$(this).children('b').removeClass('ui-icon-triangle-1-e').addClass('ui-icon-triangle-1-se');
					}else{
						$(this).children('b').removeClass('ui-icon-triangle-1-se').addClass('ui-icon-triangle-1-e');
					}
				});
				//设置用户双击事件
				$('#xmppIM_contactList').find('li.user').live('click',function(){					
					chatManager.createOne2OneChat(this.id);
				}).live('mouseover', function(){
					if(!$(this).hasClass('ui-state-highlight')){
						$(this).addClass('ui-state-highlight ui-corner-all');
					}
				}).live('mouseout', function(){
					$(this).removeClass('ui-state-highlight ui-corner-all');
				});
				hasInit = true;
			}
		};
		/**
		 * private
		 * 创建一个联系人列表里一个item
		 */
		var createContactItem = function($group, item){
			var $item = $group.find('#'+item.jid.replace(/@/, '\\@'));
			if($item.length > 0){//如果列表上已有该联系人
				$item.children('a').text(item.nickName);
			}else{
				$('<li/>').attr('id', item.jid).addClass('user').append($('<b/>').addClass('ui-icon ui-icon-comment'))
					.append($('<a/>').text(item.nickName)).append($('<span/>')).appendTo($group);
			}
		};
		connection.addHandler(onJabberRoster, Strophe.NS.ROSTER, 'iq', null, null, null);
		return rosterManager;
	};
	
	/**
	 * 类，搜索并添加好友的对话框
	 */
	function SearchUserDialog(param){
		var container = param['container'];
		var setting = param['setting'];
		var rosterManager = $.xmppIM.manager.getRosterManager();
		var connection = param['connection'];
		hasInit = false;//是否已初始化
		var loadHtml = function(){
			if(!hasInit){
				$('<div/>').appendTo(this.container)
							.load(this.setting.path + '/html/addContact.html', function(){
								initSelectTypeEvent();
								initButtonEvent();
								initSelectServiceEvent();
								initSearchInputEvent();
								hasInit = true;
							});
			}
		};
		var initSelectTypeEvent = function(){
			//选择添加好友的方式
			$('#xmppIM_addContact_Dialog').find('[name="xmppIM_searchJID"]:radio').click(function(){
				if($(this).val() == 1){//直接输入帐号
					$('#xmppIM_searchJID').show();
					$('#xmppIM_searchDetail').hide();
					showAddUserBtn('xmppIM_searchButton_Search');
					$('#xmppIM_searchJID_error').hide();
				}else{//查找
					$('#xmppIM_searchJID').hide();
					$('#xmppIM_searchDetail').show();
					$('#xmppIM_searchService').change();
				}
				showAddUserBtn('xmppIM_searchButton_Search');
			});
		};
		var initButtonEvent = function(){
			//设置添加好友对话框的按钮事件
			$('#xmppIM_searchButton_Cancel').click(function(){
				$('#xmppIM_addContact_Dialog').dialog('close');
			});			
			//查找按钮
			$('#xmppIM_searchButton_Search').click(function(){
				var type = $('[name="xmppIM_searchJID"][checked]:radio').val();
				if(type == 1){
					searchForJID();
				}else{
					searchForDetail();
				}
			});				
			//上一步
			$('#xmppIM_searchButton_preScreen').click(function(){
				$(this).hide();
				$('#xmppIM_searchPanel').add('#xmppIM_searchButton_Search').show();
				$('#xmppIM_searchPanel').find('input[type="text"]').val('');
			});
			//继续添加好友
			$('#xmppIM_searchButton_Continue').click(function(){
				$('#xmppIM_searchPanel').show();
				$('#xmppIM_searchPanel').find('input[type="text"]').val('');
				showAddUserBtn('xmppIM_searchButton_Search');
			});
		};
		var initSelectServiceEvent = function(){
			//选择搜索服务	
			$('#xmppIM_searchService').change(function(){
				var value = $(this).val();
				var $form = $('#'+$.xmppIM.util.escapeAddress(value));
				if($form.length > 0){
					$('#xmppIM_searchForm > div').hide();
					$form.show();
				}else{
					//加载表单
					$('#xmppIM_searchForm > div').hide();
					if($('#xmppIM_searchFormMsg').length == 0){
						$('<span/>',{
							id:'xmppIM_searchFormMsg',
							text:'正在加载表单……',
							color:'red'
						}).appendTo('#xmppIM_searchForm');
					}else{
						$('#xmppIM_searchFormMsg').text('正在加载表单……');
					}
					var iq = $iq({type:'get', to:value}).c('query', {xmlns: Strophe.NS.SEARCH_USER, 'xml:lang':'zh-cn'});
					connection.sendIQ(iq, function(formIQ){
						console.log('这个', formIQ);
						$('#xmppIM_searchFormMsg').remove();
						var dataForm = new DataForm(formIQ);
						var $div = $('<div/>',{id:value}).appendTo('#xmppIM_searchForm').data('dataForm', dataForm);
						dataForm.toJQuery().appendTo($div);
					}, function(){
						$('#xmppIM_searchFormMsg').text('加载表单时出错');
					});
				}
			});
		};
		var initSearchInputEvent = function(){
			$('#xmppIM_searchJID').focus(function(){
				showSearchMessage();
			});
		};
		/**
		 * 辅助函数，在添加好友对话框里用
		 * 传进去的id全部显示，并隐藏其他
		 */
		var showAddUserBtn = function(){
			$('#xmppIM_searchButton > button').not('#xmppIM_searchButton_Cancel').hide();
			$.each(arguments, function(i,id){
				$('#'+id).show();
			});
		};
		/**
		 * 搜索时显示相关信息
		 */
		var showSearchMessage = function(msg, isError){
			if(msg){
				if(isError){
					$('#xmppIM_searchJID_error').removeClass('ui-state-highlight')
						.addClass('ui-state-error').text(msg);
				}else{
					$('#xmppIM_searchJID_error').removeClass('ui-state-error')
					.addClass('ui-state-highlight').text(msg);
				}
			}else{
				$('#xmppIM_searchJID_error').hide();
			}
		};
		/**
		 * 打开添加好友的对话框
		 */
		var openAddContactDlg = function(){
			$('#xmppIM_searchJID_result').dialog({
				width:310,
				height:220,
				modal:true,
				buttons:{
					'关闭' : function(){
						$(this).dialog('close');
					},
					'添加好友'	: function(){
						addContact();
					}
				}
			});
		};
		/**
		 * 按条件查找
		 */
		var searchForDetail = function(){
			var val = $('#xmppIM_searchService').val();
			var iq = $('#'+$.xmppIM.util.escapeAddress(val)).data('dataForm').toSubmitIQ();
			this.connection.sendIQ(iq, function(result){
				console.log('搜索结果', result);
			}, function(result){
				console.log('搜索出错', result);
			});
		};
		/**
		 * 直接通过帐号添加好友
		 */
		var searchForJID = function(){
			var userId = $('#xmppIM_txtSearchJID').val();
			if($.trim(userId) != ''){
				var jid = rosterManater.makeJID(userId, true);
				if(rosterManater.existEntry(jid)){
					$('#xmppIM_searchJID_error').show().text('该用户已在您联系人列表中');
				}else{
					var queryIQ = $iq({type: 'get', from:setting.userId, to: jid}).c('query', {xmlns: Strophe.NS.DISCO_INFO});					
					showSearchMessage('正在查询……');
					connection.sendIQ(queryIQ.tree(), function(iq){
						showSearchMessage();
						openAddContactDlg();
						$('#xmppIM_searchJID_resultJID').text(jid);
						$('#xmppIM_searchJID_resultNickname').val(userId);
						createGroupSelect($('#xmppIM_searchJID_resultGroup'));
						$('#xmppIM_searchJID_addContact').show();
						$('#xmppIM_searchJID_resultInfo').html('<b>添加该用户到您的联系人名单</b>');
					}, function(iq){
						showSearchMessage('找不到该用户',true);
					});
				}
			}else{
				//$('#xmppIM_searchJID_error').show().text('请输入帐号');
				showSearchMessage('请输入帐号',true);
			}
		};
		/**
		 * 添加联系人，
		 * jid	对方的jid
		 * type	1直接输入用户名添加，2通过查找用户然后添加
		 */
		var addContact = function(){
			var jid = $('#xmppIM_searchJID_resultJID').text();
			var nickName = $.trim($('#xmppIM_searchJID_resultNickname').val());
			var group = $('#xmppIM_searchJID_resultGroup').val();
			$('#xmppIM_searchJID_addContact').hide();
			$('#xmppIM_searchJID_resultInfo').html('已添加'+jid+'到您的联系人列表，请等待对方确认您的请求');
			sendAddContactIQ(jid, nickName, group);
			showAddUserBtn('xmppIM_searchButton_Continue');
		};
		/**
		 * 发送添加好友请求的IQ
		 */
		var sendAddContactIQ = function(jid, nickName, groupName){
			var iq = $iq({type: 'set'}).c('query', {xmlns: Strophe.NS.ROSTER});
			if(nickName != ''){
				iq.c('item', {'jid': jid, 'name':nickName});
			}else{
				iq.c('item', {'jid': jid});
			}
			if(groupName != ''){
				iq.cnode(Strophe.xmlElement('group','',groupName));
			}
			connection.sendIQ(iq, function(){
				var p = $pres({to:jid, type:$.xmppIM.PresenceType.subscribe})
					.cnode(Strophe.xmlElement('status','','我想加你为好友'));
				connection.send(p.tree());
			});
		};
		//加载html并初始化
		this.loadHtml();
		return {
			/**
			 * 显示添加好友的对话框
			 */
			showDialog : function(){
				$('#xmppIM_addContact_Dialog').dialog({
					height : 280,
					width : 400,
					title : '查找或添加联系人',
					open: function(event, ui){
						$('#xmppIM_searchDetail').hide();
						$('#xmppIM_searchPanel').show();
						$(event.target).after($('#xmppIM_searchButton').show());
						$('#xmppIM_rad_searchJID').click();
					}
				});
			},
			/**
			 * 生成联系人分组下拉选项
			 */
			createGroupSelect : function($select){
				$select.each(function(){
					var $this = $(this);
					$this.empty();
					$('<option/>', {
						value: name,
						text : '--请选择--'
					}).appendTo($this);
					$.each(rosterManater.getAllGroups(), function(name, list){
						$('<option/>', {
							value: name,
							text : name
						}).appendTo($this);
					});
				});
			}
		};
	};	
	
	/**
	 * 类，解析DataForm生成相应的html
	 */
	function DataForm(formIQ){
		this.iq = $(formIQ);
		this.tableHtml = '';
		this.jQueryTable;
		if(this.iq){
			this.parseForm(this.iq);
		}
	};
	$.extend(DataForm.prototype, {
		/**
		 * 返回html表单的jQuery对象
		 */
		toJQuery : function(){
			return this.jQueryTable;
		},
		/**
		 * 转换成提交表单的IQ
		 */
		toSubmitIQ : function(){
			var iq = $iq({type: 'set', to: this.iq.attr('from')})
					.c('query', {xmlns: Strophe.NS.SEARCH_USER, 'xml:lang':"zh-cn"})
					.c('x', {xmlns: Strophe.NS.DATA_FORM, 'type':"submit"});
			$(':input',this.jQueryTable).each(function(){
				var $this = $(this);
				var field = iq.c('field', {'var': $this.attr('name')});
				var val = $this.val();
				if($this.attr('xtype')=='list-multi' && val != null){//多选
					console.log(val);					
					$.each(val, function(i, v){
						field.cnode(Strophe.xmlElement('value','',v)).up();
					});
				}else{
					if($this.attr('xtype')=='boolean'){
						val = $this.attr('checked') ? '1' : '0'; 
					}
					field.cnode(Strophe.xmlElement('value','',val)).up();
				}
				field.up();
			});
			return iq;
		},
		/**
		 * 解析整个表单
		 */
		parseForm : function(iq){
			if(iq.find('x[xmlns="jabber:x:data"][type="form"]').length > 0){
				var _this = this;
				//定义字段的处理函数
				var fieldTypeHandler = {
						'boolean' : _this.parseBoolean,
						'hidden' : _this.parseHidden,
						'list-multi' : _this.parseListMulti,
						'list-single' : _this.parseListSingle,
						'text-multi' : _this.parseTextMulti,
						'text-private' : _this.parseTextPrivate,
						'text-single' : _this.parseTextSingle
				};
				var tableTemplate = '<table width="100%" border="0" cellspacing="0" cellpadding="0">{0}</table>';
				var template = '<tr><td>{0}<tr><td>';
				iq.find('field').each(function(){
					var type = $(this).attr('type');
					if(fieldTypeHandler[type]){
						_this.tableHtml += $.xmppIM.util.format(template, fieldTypeHandler[type].call(_this, $(this)));
					}
				});
				_this.tableHtml = $.xmppIM.util.format(tableTemplate, _this.tableHtml);
				_this.jQueryTable = $(_this.tableHtml);
			}
		},
		//private
		parseBoolean : function($f, _this){
			var template = '<input name="{0}" xtype="boolean" type="checkbox" value="{1}" checked="checked" required="{2}"/><label for="{0}">{3}</label>';
			var o = this.getFieldObj($f);
			return $.xmppIM.util.format(template, o.name,  o.value, o.required, o.label);
		},
		//private
		parseHidden : function($f, _this){
			var template = '<input name="{0}" type="hidden" value="{1}" xtype="hidden"/>';
			var o = this.getFieldObj($f);
			return $.xmppIM.util.format(template, o.name,  o.value);
		},
		//private
		parseListMulti : function($f, _this){
			var template = '<label for="{0}">{3}</label>:<select xtype="list-multi" name="{0}" multiple="multiple" size="4" required="{2}">{1}</select>';
			return this.parseList($f, template, _this);
		},
		//private
		parseListSingle : function($f, _this){
			var template = '<label for="{0}">{3}</label>:<select xtype="list-single" name="{0}" required="{2}">{1}</select>';
			return this.parseList($f, template, _this);
		},
		/**
		 * private
		 * 辅助函数
		 */
		parseList : function($f, template, _this){
			var optionTemplate = '<option value="{0}" {1}>{2}</option>';
			var selected = 'selected="selected"';
			var options = '';
			var o = this.getFieldObj($f);
			console.log(o);
			$.each(o.option, function(i,n){
				options += $.xmppIM.util.format(optionTemplate, n.value, n.value==o.value?selected:'', o.label);
			});
			return $.xmppIM.util.format(template, o.name, options, o.required, o.label);
		},
		//private
		parseTextMulti : function($f, _this){
			var template = '<label for="{0}">{3}</label>:<textarea xtype="text-multi" name="{0}" value="{1}" required="{2}"></textarea>';
			var o = this.getFieldObj($f);
			return $.xmppIM.util.format(template, o.name, o.value, o.required, o.label);
		},
		//private
		parseTextPrivate : function($f, _this){
			var template = '<label for="{0}">{3}</label>:<input xtype="text-private" name="{0}" type="password" value="{1}" required="{2}"/>';
			var o = this.getFieldObj($f);
			return $.xmppIM.util.format(template, o.name, o.value, o.required, o.label);
		},
		//private
		parseTextSingle : function($f, _this){
			var template = '<label for="{0}">{3}</label>:<input xtype="text-single" name="{0}" type="text" value="{1}" required="{2}"/>';
			var o = this.getFieldObj($f);
			return $.xmppIM.util.format(template, o.name, o.value, o.required, o.label);
		},
		/**
		 * private
		 * 返回field数据对象
		 */
		getFieldObj : function($f){
			var obj = {};
			obj['name'] = $f.attr('var');
			obj['label'] = $f.attr('label');
			var value = '';
			if(type == 'text-multi'){
				$f.children('value').each(function(){
					value += $(this).text();
				});
			}else{
				value = $f.children('value:eq(0)').text();
			}
			obj['value'] = value;
			obj['required'] = $(this).children('required').length;
			var type = $f.attr('type');
			if(type == 'list-multi' || type == 'list-single'){
				obj['option'] = [];
				console.log($f.html());
				$f.children('option').each(function(){
					var op = {};
					op['label'] = $(this).attr('label');
					op['value'] = $(this).children('value').text();
					obj['option'].push(op);
				});
			}
			return obj;
		}
	});	
	
	//debug
	Strophe.log = function (level, msg) {
		jQuery('#logger').append(jQuery('<div/>').text(msg));
	};
	
	function rawInput(data)
	{
		Strophe.log(Strophe.LogLevel.DEBUG, 'RECV: ' + data);
	};
	
	function rawOutput(data)
	{
		Strophe.log(Strophe.LogLevel.DEBUG, 'SENT: ' + data);
	};
	
	function test(){
		var form =  "<iq xmlns=\"jabber:client\" xmlns:stream=\"http://etherx.jabber.org/streams\" type=\"result\" id=\"sd82\" from=\"search.gyoa\" to=\"lxp@gyoa\">"
			+"	<query xmlns=\"jabber:iq:search\">"
			+"		<instructions>The following fields are available for searching. Wildcard (*) characters are allowed as part the of query.</instructions>"
			+"		<first/>"
			+"		<last/>"
			+"		<nick/>"
			+"		<email/>"
			+"		<x xmlns=\"jabber:x:data\" type=\"form\">"
			+"			<title>Bot Configuration</title>"
			+"      <instructions>Fill out this form to configure your new bot!</instructions>"
			+"      <field type='hidden'"
			+"             var='FORM_TYPE'>"
			+"        <value>jabber:bot</value>"
			+"      </field>"
			+"      <field type='fixed'><value>Section 1: Bot Info</value></field>"
			+"      <field type='text-single'"
			+"             label='The name of your bot'"
			+"             var='botname'/>"
			+"      <field type='text-multi'"
			+"             label='Helpful description of your bot'"
			+"             var='description'/>"
			+"      <field type='boolean'"
			+"             label='Public bot?'"
			+"             var='public'>"
			+"        <required/><value>1</value>"
			+"      </field>"
			+"      <field type='text-private'"
			+"             label='Password for special access'"
			+"             var='password'/>"
			+"      <field type='fixed'><value>Section 2: Features</value></field>"
			+"      <field type='list-multi'"
			+"             label='What features will the bot support?'"
			+"             var='features'>"
			+"        <option label='Contests'><value>contests</value></option>"
			+"        <option label='News'><value>news</value></option>"
			+"        <option label='Polls'><value>polls</value></option>"
			+"        <option label='Reminders'><value>reminders</value></option>"
			+"        <option label='Search'><value>search</value></option>"
			+"        <value>news</value>"
			+"        <value>search</value>"
			+"      </field>"
			+"      <field type='fixed'><value>Section 3: Subscriber List</value></field>"
			+"      <field type='list-single'"
			+"             label='Maximum number of subscribers'"
			+"             var='maxsubs'>"
			+"        <value>20</value>"
			+"        <option label='10'><value>10</value></option>"
			+"        <option label='20'><value>20</value></option>"
			+"        <option label='30'><value>30</value></option>"
			+"        <option label='50'><value>50</value></option>"
			+"        <option label='100'><value>100</value></option>"
			+"        <option label='None'><value>none</value></option>"
			+"      </field>"
			+"      <field type='fixed'><value>Section 4: Invitations</value></field>"
			+"      <field type='jid-multi'"
			+"             label='People to invite'"
			+"             var='invitelist'>"
			+"        <desc>Tell all your friends about your new bot!</desc>"
			+"      </field>"
			+"		</x>"
			+"	</query>"
			+"</iq>";
		//alert(new DataForm($(form)));
		dataForm = new DataForm(form);
		(dataForm).toJQuery().appendTo($('body'));
		
	};
	function submitTest(){
		console.log(dataForm.toSubmitIQ().tree());
	}
	var dataForm;
	$(function(){
		test();
		$('#btnTest').click(function(){
			submitTest();
		});
	});
})(jQuery);