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
				title: 'WEB IM'
			},
			/**
			 * XMPP协议的namespace
			 */
			NS:{
				IQ_ROSTER : 'jabber:iq:roster',
				VCARD_TEMP: 'vcard-temp'
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
	
	/**
	 * 一些工具函数
	 */
	$.xmppIM.util = {
			/**
			 * 传入cody@gyoa/spark 返回cody@gyoa
			 */
			parseBareAddress : function(XMPPAddress){
				if (XMPPAddress == null) {
		            return null;
		        }
		        var slashIndex = XMPPAddress.indexOf("/");
		        if (slashIndex < 0) {
		            return XMPPAddress;
		        }
		        else if (slashIndex == 0) {
		            return "";
		        }
		        else {
		            return XMPPAddress.substring(0, slashIndex);
		        }
			},
			/**
			 * 传入cody@gyoa/spark 返回spark
			 */
			parseResource : function(XMPPAddress){
				if (XMPPAddress == null) {
		            return null;
		        }
		        var slashIndex = XMPPAddress.indexOf("/");
		        if (slashIndex + 1 > XMPPAddress.length() || slashIndex < 0) {
		            return "";
		        }
		        else {
		            return XMPPAddress.substring(slashIndex + 1);
		        }
			},
			/**
			 * 传入cody@gyoa/spark 返回gyoa
			 */
			parseServer: function(XMPPAddress){
				if (XMPPAddress == null) {
		            return null;
		        }
		        var atIndex = XMPPAddress.lastIndexOf("@");
		        // If the String ends with '@', return the empty string.
		        if (atIndex + 1 > XMPPAddress.length()) {
		            return "";
		        }
		        var slashIndex = XMPPAddress.indexOf("/");
		        if (slashIndex > 0 && slashIndex > atIndex) {
		            return XMPPAddress.substring(atIndex + 1, slashIndex);
		        }
		        else {
		            return XMPPAddress.substring(atIndex + 1);
		        }
			},
			/**
			 * 传入cody@gyoa/spark 返回cody
			 */
			parseName: function(XMPPAddress){
				if (XMPPAddress == null) {
		            return null;
		        }
		        var atIndex = XMPPAddress.lastIndexOf("@");
		        if (atIndex <= 0) {
		            return "";
		        }
		        else {
		            return XMPPAddress.substring(0, atIndex);
		        }
			},
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
			}
	};
	
	function xmppIM_component() {
		return {
			connection : {},
			container : {},
			$mainDlg : {},
			setting : $.extend( {}, $.xmppIM.defaults),
			chatRoomDlgList : {},//保存全部聊天对话框
			/**
			 * {
					presence:{jid:{type, status, priority, mode, language}},
					groups:{goupsName:{jid:{entriy},jid:{entriy},...},
					entries:{jid:{jid, nickName, type, status, groups:[name,name,...]}}
				}
			 */
			roster : {presence:{}, groups:{}, entries:{}}, //保存用户的联系人列表，还包括分组列表和在线状态
			hasInit: false,//是否已初始化
			curUserJid:'',
			/**
			 * 初始化
			 */
			init : function(elem, conf) {
				this.container = $(elem);
				this.setting = $.extend(true, {}, this.setting, conf);
				this.connection = new Strophe.Connection(this.setting.service);
				this.container.addClass(this.setting.workspaceClass);
				this.showLoginDlg();
				//debug
				if(IS_DEBUG){
					jQuery('<div/>').css('position','absolute').css('width','100%').css('height','300px')
					.css('bottom','0px').css('overflow-y','auto').css('background','#000').css('color','#FFFFFF').css('z-index','999').attr('id', 'logger').appendTo(jQuery('body:eq(0)'));
					this.connection.rawInput = rawInput;
				    this.connection.rawOutput = rawOutput;
				}
			},
			/**
			 * 加载并显示登录界面
			 */
			showLoginDlg : function() {
				this.container.load(this.setting.path + '/html/login.html');
				this.container.dialog( {
					buttons : {
						"登陆" : function() {
							thisComponent.curUserJid = thisComponent.makeJID($('#xmppIM_login_userId').val());
							var password = $('#xmppIM_login_password').val();
							thisComponent.connection.connect(thisComponent.curUserJid, password, thisComponent.onConnect);
						}
					},
					height : 500,
					width : 260,
					title : thisComponent.setting.title
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
					thisComponent.container.dialog('option', 'title', thisComponent.setting.title + ' - ' + thisComponent.curUserJid);
					//处理函数、namespace 、包名、包的type属性、包id、包的from属性、options
					thisComponent.attachHandler.call(thisComponent);
					thisComponent.initWorkspace.call(thisComponent);
					
					//发送在线的Presence
					thisComponent.connection.send($pres().tree());
				}else if(status == Strophe.Status.AUTHFAIL){
				}else if(status == Strophe.Status.ATTACHED){
				}else if(status == Strophe.Status.ERROR){
				}
			},
			/**
			 * 登录成功后执行，设置数据包处理函数
			 */
			attachHandler : function(){
				//this.connection
				this.connection.addHandler(this.onMessage, null, 'message', 'chat', null, null);
				this.connection.addHandler(this.onJabberRoster, $.xmppIM.NS.IQ_ROSTER, 'iq', null, null, null);
			},
			/**
			 * 登陆成功后初始化IM界面
			 */
			initWorkspace : function(){
				this.container.load(this.setting.path + '/html/workspace.html', function(){
					$('#xmppIM_contactPanel').tabs();
					//<iq type="get" id="sd4"><query xmlns="jabber:iq:roster"/></iq>
					var queryRoster = $iq({type: 'get'}).c('query', {xmlns: $.xmppIM.NS.IQ_ROSTER});
					thisComponent.connection.send(queryRoster.tree());
					//聊天对话框的发送按钮事件
					$('#xmppIM_btnSendMsg').button().live('click', function(){
						thisComponent.sendMessage($(this));
					});
					$('#xmppIM_msgContent').live('keypress', function(event){
						if (event.keyCode == '13') {
							var $btn = $(this).parents('div.inputArea').find('#xmppIM_btnSendMsg');
							thisComponent.sendMessage($btn);
							return false;
						}
					});
				});
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
					var msg = $msg({type:'chat', from:thisComponent.curUserJid, to:targetJID})
						.cnode(Strophe.xmlElement('body','',content));
					var nickName = thisComponent.curUserJid;
					thisComponent.connection.send(msg.tree());
					thisComponent.insertChatLog($dlg, nickName, new Date(), content, 'itemHeaderTo');
				}
			},
			/**
			 * 处理收到的短消息
			 */
			onMessage : function(msg){
				var $msg = $(msg);
				var from = $msg.attr('from');
				var content = $msg.children('body').length > 0 ? $msg.children('body').text() : '';
				var $dlg = thisComponent.createOne2OneChat(from);
				var $chatLog = $dlg.find('div[type="template"]').clone().removeAttr('type');
				var nickName = thisComponent.getNickName(from);
				thisComponent.insertChatLog($dlg, nickName, new Date(), content, 'itemHeaderFrom');
				return true;
			},
			/**
			 * 插入一条聊天记录到对话框里
			 */
			insertChatLog : function($dlg, nickName, date, content, className){
				var $chatLog = $dlg.find('div[type="template"]').clone().removeAttr('type');
				$chatLog.find('span.logUserName').text(nickName);
				$chatLog.find('span.logTime').text($.xmppIM.util.dateFormat(new Date, thisComponent.setting.dateFormat));
				$chatLog.find('div.content').text(content);
				$chatLog.find('div[type="logItemHeader"]').addClass(className);
				$chatLog.appendTo($dlg.find('div.chatLog')).show();
			},
			/**
			 * 处理联系人列表
			 * <iq xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams" type="result" id="sd113" to="small@viking/潘迪安">
			 * 	<query xmlns="jabber:iq:roster">
			 * 		<item jid="abc@viking" subscription="both"/>
			 * 		<item jid="cody@viking" subscription="both"><group>我的好友</group></item>
			 * 		<item jid="admin@viking-pc" subscription="both"/>
			 * 		<item jid="lxp@viking" subscription="both"><group>我的好友</group></item>
			 * </query></iq>
			 */
			onJabberRoster : function(iq){
				var newRosters = [];
				$(iq).find('item').each(function(){
					var $this = $(this);
					var item = {jid:'', nickName:'', type:'', status:'', groups:[]};
					item.jid = $this.attr('jid');
					item.nickName = $this.attr('name') ? $this.attr('name') : item.jid;
					item.type = $this.attr('subscription');
					item.status = $this.attr('ask');
					//保存分组
					var group = thisComponent.roster.groups[item.jid] ? thisComponent.roster.groups[item.jid] : {};
					$this.children('group').each(function(){
						var groupName = $(this).text();
						item.groups.push(groupName);
						var groups;
						if(thisComponent.roster.groups[groupName]){
							groups = thisComponent.roster.groups[groupName];
						}else{
							groups = {};
							thisComponent.roster.groups[groupName] = groups;
						}
						groups['name'] = groupName;
						groups[item.jid] = item;
					});
					thisComponent.roster.entries[item.jid] = item;
					newRosters.push(item);
				});
				thisComponent.createRosterTree(newRosters);
				return true;
			},
			/**
			 * 创建联系人列表
			 */
			createRosterTree : function(entries){
				var groupTemplate = $('#xmppIM_defaultContact_Group').clone();//先复制一个用作模板
				//默认分组的名称
				var defaultGroupName = groupTemplate.find('a[type="xmppIM_contactGroup_Header"]:eq(0)').text();
				$.each(entries, function(i, item){
					//创建group
					if(item.groups.length > 0){
						$.each(item.groups, function(i, name){
							var $group = $('#'+name);
							if($group.length == 0 && name != defaultGroupName){//检查是否已建了该分组
								$group = groupTemplate.clone().attr('id', name)
									.prependTo('#xmppIM_contactList')
									.find('span[type="xmppIM_contactGroup_Header"] > a')
									.text(name).end();
							}
							var targetGroup;
							if(name == defaultGroupName){
								targetGroup = $('#xmppIM_defaultContact_Group').find('ul:eq(0)');
							}else{
								targetGroup = $group.find('ul:eq(0)');
							}
							thisComponent.createContactItem(targetGroup, item);
						});//end each
					}else{
						var targetGroup = $('#xmppIM_defaultContact_Group').find('ul:eq(0)');
						thisComponent.createContactItem(targetGroup, item);
					}
				});
				//初始化时设置事件
				if(!thisComponent.hasInit){
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
						thisComponent.createOne2OneChat(this.id);
					}).live('mouseover', function(){
						if(!$(this).hasClass('ui-state-highlight')){
							$(this).addClass('ui-state-highlight ui-corner-all');
						}
					}).live('mouseout', function(){
						$(this).removeClass('ui-state-highlight ui-corner-all');
					});					
					thisComponent.hasInit = true;
				}
			},
			/**
			 * 创建一个联系人列表里一个item
			 */
			createContactItem : function($group, item){
				var $item = $group.find('#'+item.jid.replace(/@/, '\\@'));
				if($item.length > 0){//如果列表上已有该联系人
					$item.children('a').text(item.nickName);
				}else{
					$('<li/>').attr('id', item.jid).addClass('user').append($('<b/>').addClass('ui-icon ui-icon-comment'))
						.append($('<a/>').text(item.nickName)).appendTo($group);
				}
			},
			/**
			 * 创建一对一的聊天对话
			 */
			createOne2OneChat : function(jid){
				//生成聊天对话框
				if(thisComponent.chatRoomDlgList[jid]){
					thisComponent.chatRoomDlgList[jid].dialog('open').dialog( "moveToTop" );
				}else{
					var $chatRoomDlg = $('#xmppIM_chatDialog').clone(true).attr('id', 'xmppIM_chatDialog_'+jid).appendTo($('#xmppIM_chatDialog'));
					$('#xmppIM_targetJID', $chatRoomDlg).val(jid);
					thisComponent.chatRoomDlgList[jid] = $chatRoomDlg;
					$chatRoomDlg.dialog({
						height : 413,
						width : 525,
						title : '与 '+thisComponent.getNickName(jid)+' 聊天',
						resizable: false
					});
				}
				return thisComponent.chatRoomDlgList[jid];
			},
			/**
			 * 获取联系人信息
			 */
			getEntry: function(jid){
				return thisComponent.roster.entries[jid];
			},
			/**
			 * 获取昵称
			 */
			getNickName : function(jid){
				var entry = thisComponent.getEntry($.xmppIM.util.parseBareAddress(jid));
				if(entry){
					return entry.nickName;
				}else{
					return jid;
				}
			},
			makeJID : function(userId){
				return userId + "@" + this.setting.domain + "/" + this.setting.resource;
			}			 
		};
	};
	
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
	}
})(jQuery);