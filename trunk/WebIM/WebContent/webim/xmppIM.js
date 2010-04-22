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
				return XMPPAddress.replace(/@/, '\\@').replace(/\//g, '\\/');
			},
			/**
			 * 把字符串转换成整数，如果转换失败则返回0
			 */
			parseInt : function(str){
				var n = parseInt(str);
				return isNaN(n) ? 0 : n;
			}
			
	};
	
	function xmppIM_component() {
		return {
			connection : {},
			container : {},
			setting : $.extend( {}, $.xmppIM.defaults),
			chatRoomDlgList : {},//保存全部聊天对话框
			/**
			 * {
					presence:{jid:{resource:{type, status, priority, mode, language},...}},
					groups:{goupsName:{jid:{entriy},jid:{entriy},...},
					entries:{jid:{jid, nickName, type, status, groups:[name,name,...]}}
				}
			 */
			roster : {presence:{}, groups:{}, entries:{}}, //保存用户的联系人列表，还包括分组列表和在线状态
			hasInit: false,//是否已初始化
			curUserJid:'',
			discoverItems:[],
			defaultGroupName:'',//默认分组的名称
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
			 * 初始化namespace
			 */
			initNamespace : function(){
				Strophe.addNamespace('VCARD_TEMP', 'vcard-temp');
				Strophe.addNamespace('SEARCH_USER', 'jabber:iq:search');				
			},
			/**
			 * 加载并显示登录界面
			 */
			showLoginDlg : function() {
				this.container.load(this.setting.path + '/html/login.html', function(){
					$('#xmppIM_btnLogin').button().click(function(){
						thisComponent.curUserJid = thisComponent.makeJID($('#xmppIM_login_userId').val());
						var password = $('#xmppIM_login_password').val();
						thisComponent.connection.connect(thisComponent.curUserJid, password, thisComponent.onConnect);
					});
				});				
				this.container.dialog({
					height : 500,
					width : 260,
					title : thisComponent.setting.title,
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
					thisComponent.container.dialog('option', 'title', thisComponent.setting.title + ' - ' + thisComponent.curUserJid);
					//初始化
					thisComponent.attachHandler.call(thisComponent);
					thisComponent.initWorkspace.call(thisComponent);
					$(window).unload(function() { 
						thisComponent.connection.disconnect();
					});
				}else if(status == Strophe.Status.AUTHFAIL){
					thisComponent.connection.disconnect();
				}else if(status == Strophe.Status.ATTACHED){
				}else if(status == Strophe.Status.ERROR){
					thisComponent.connection.disconnect();
				}
			},
			/**
			 * 登录成功后执行，设置数据包处理函数
			 */
			attachHandler : function(){
				//this.connection
				this.connection.addHandler(this.onMessage, null, 'message', 'chat', null, null);
				this.connection.addHandler(this.onJabberRoster, Strophe.NS.ROSTER, 'iq', null, null, null);
				this.connection.addHandler(this.onDiscoverItems, Strophe.NS.DISCO_ITEMS, 'iq', null, null, null);
				this.connection.addHandler(this.onPresence, null, 'presence', null, null, null);
			},
			/**
			 * 登陆成功后初始化IM界面
			 */
			initWorkspace : function(){
				this.container.load(this.setting.path + '/html/workspace.html', function(){
					thisComponent.defaultGroupName = $('#'+thisComponent.setting.defaultGroupId)
														.find('span[type="xmppIM_contactGroup_Header"]:eq(0)')
														.text();
					$('#xmppIM_contactPanel').tabs();
					//查询服务器提供的服务
					var queryDiscoverItem = $iq({type: 'get', to: thisComponent.setting.domain}).c('query', {xmlns: Strophe.NS.DISCO_ITEMS});
					thisComponent.connection.send(queryDiscoverItem.tree());
					//获取联系人
					var queryRoster = $iq({type: 'get'}).c('query', {xmlns: Strophe.NS.ROSTER});
					thisComponent.connection.send(queryRoster.tree());
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
					thisComponent.updatePresence($.xmppIM.PresenceMode.available, '8');
				});
			},
			/**
			 * 初始化更新在线状态的菜单
			 */
			initUpdatePresenceMenu : function(){
				$('#xmppIM_updatePresence').contextMenu('xmppIM_presenceMenu', {
					bindings : {
						'available' : function(t) {
							thisComponent.updatePresence($.xmppIM.PresenceMode.available, '8');
						},
						'chat' : function(t) {
							thisComponent.updatePresence($.xmppIM.PresenceMode.chat, '10');
						},
						'away' : function(t) {
							thisComponent.updatePresence($.xmppIM.PresenceMode.away, '4');
						},
						'dnd' : function(t) {
							thisComponent.updatePresence($.xmppIM.PresenceMode.dnd, '6');
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
			 * 辅助函数，在initUpdatePresenceMenu里调用
			 */
			updatePresence : function(mode, priority){
				var status = thisComponent.setting.presence[mode];
				if(mode == $.xmppIM.PresenceMode.available){
					thisComponent.connection.send($pres()
							.cnode(Strophe.xmlElement('status','',thisComponent.setting.presence[mode])).up()
							.cnode(Strophe.xmlElement('priority','',priority))
							.tree());
				}else{
					thisComponent.connection.send($pres()
							.cnode(Strophe.xmlElement('show','',$.xmppIM.PresenceMode[mode])).up()
							.cnode(Strophe.xmlElement('priority','',priority)).up()
							.cnode(Strophe.xmlElement('status','',thisComponent.setting.presence[mode]))
							.tree());
				}
				$('#xmppIM_updatePresence > span:eq(0)').text(status);
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
						$.each(thisComponent.roster.entries,function(jid, entry){
							if(matcher.test(entry.nickName)){
								result.push({'label':entry.nickName+'('+jid+')','value':entry.nickName,'jid':jid});
							}
							if(result.size >= maxResult){
								return false;
							}
						});
						if(result.length < maxResult){
							$.each(thisComponent.roster.entries,function(jid, entry){
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
						var presence = thisComponent.roster.presence[ui.item.jid];
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
					$('#xmppIM_addContact_Dialog').dialog({
						height : 300,
						width : 400,
						title : '查找联系人',
						open: function(event, ui){
							$('#xmppIM_searchDetail').hide();
						},
						buttons:{
							"取消":function(){
							},
							"查找":function(){
							}
						}
					});
				});
			},
			/**
			 * 解析服务器提供的服务
			 */
			onDiscoverItems : function(iq){
				$(iq).find('item').each(function(){
					var $this = $(this);
					var item = {jid:'', name:''};
					item.jid = $this.attr('jid');
					item.name = $this.attr('name');
					thisComponent.discoverItems.push(item);
				});
			},
			/**
			 * 处理presence
			 */
			onPresence : function(p){
				var $p = $(p);
				var presence = {type:'', status:'', priority:'', mode:'', language:''};
				presence.type = $p.attr('type');
				if(presence.type == undefined || presence.type==''){
					presence.type = $.xmppIM.PresenceType.available;
				}
				var from = $p.attr('from');
				var resource = Strophe.getResourceFromJid(from);
				var address = Strophe.getBareJidFromJid(from);
				console.log(p, from, presence.type, thisComponent.roster.entries);
				if(!thisComponent.roster.entries[address]){
					return;//忽略不在联系人中的jid
				}
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
					if(!thisComponent.roster.presence[address]){
						thisComponent.roster.presence[address] = {};
					}
					thisComponent.roster.presence[address][resource] = presence;
					if(!thisComponent.roster.presence[address].count){
						thisComponent.roster.presence[address].count = 0;
					}
					//更新联系人列表
					var $newItem = $('#'+$.xmppIM.util.escapeAddress(from));
					if($('#'+$.xmppIM.util.escapeAddress(from)).length == 0){
						thisComponent.roster.presence[address].count ++;
						var groups = thisComponent.roster.entries[address].groups;
						$.each(groups, function(i, groupName){
							var groupId = thisComponent.getGroupId(groupName);
							var $oldItem = $('#'+$.xmppIM.util.escapeAddress(address), $('#'+$.xmppIM.util.escapeAddress(groupId)));
							console.log($oldItem.length, groupId, address);
							//复制一个
							$newItem = $oldItem.clone(true).addClass('online').attr('id', from)
											.attr('res', resource).prependTo($oldItem.parent()).attr('resmark',false).show();							
							$oldItem.hide();
						});
					}
					$newItem.children('span').text(thisComponent.getUserStatusText(presence));
					if(thisComponent.roster.presence[address].count > 1){
						//resmark属性标识是否添加了资源提示
						$('li[id^="'+address+'"][resmark="false"] > a').text(function(index, text){
							$(this).parent().attr('resmark',true);
							return text + ' - ' + $(this).parent().attr('res');
						});
					}
					console.log('上线',thisComponent.roster.presence[address].count);
				}else if(presence.type == $.xmppIM.PresenceType.unavailable){//离线
					delete thisComponent.roster.presence[address][resource];
					--thisComponent.roster.presence[address].count;
					$('#'+$.xmppIM.util.escapeAddress(from)+'[res="'+resource+'"]').remove();
					if(thisComponent.roster.presence[address].count == 0){
						//全部资源都已离线
						$('#'+$.xmppIM.util.escapeAddress(address)).show();
					}else if(thisComponent.roster.presence[address].count == 1){
						//删除所有资源提示
						$('li[id^="'+address+'"][resmark="true"] > a').text(function(index, text){
							$(this).parent().attr('resmark',false);
							return text.substring(0, text.indexOf('-'));
						});
					}
					console.log('离线',thisComponent.roster.presence[address].count);
				}
				return true;
			},
			getUserStatusText : function(presence){
				return presence.status == '' ? thisComponent.setting.presence[presence.mode] : presence.status;
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
					//var group = thisComponent.roster.groups[item.jid] ? thisComponent.roster.groups[item.jid] : {};
					var $group = $this.children('group');
					if($group.length > 0){
						$group.each(function(){
							var groupName = $(this).text();
							thisComponent.addGroup(groupName, item);
						});
					}else{
						//如果没有分组则放到默认分组里
						thisComponent.addGroup(thisComponent.defaultGroupName, item);
					}
					thisComponent.roster.entries[item.jid] = item;
					newRosters.push(item);
				});
				thisComponent.createRosterTree(newRosters);
				return true;
			},
			/**
			 * 辅助函数，在onJabberRoster里调用
			 */
			addGroup : function(groupName, item){
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
			},
			/**
			 * 根据分组名获取分组的id
			 */
			getGroupId : function(groupName){
				return (groupName == thisComponent.defaultGroupName) ? thisComponent.setting.defaultGroupId : groupName;
			},
			/**
			 * 创建联系人列表
			 */
			createRosterTree : function(entries){
				var groupTemplate = $('#'+thisComponent.setting.defaultGroupId).clone();//先复制一个用作模板
				$.each(entries, function(i, item){
					//创建group
					$.each(item.groups, function(i, name){
						var groupId = thisComponent.getGroupId(name);
						var $group = $('#'+groupId);
						if($group.length == 0 && name != thisComponent.defaultGroupName){//检查是否已建了该分组
							$group = groupTemplate.clone().attr('id', name)
								.prependTo('#xmppIM_contactList')
								.find('span[type="xmppIM_contactGroup_Header"] > a')
								.text(name).end();
						}
						var targetGroup = $group.find('ul:eq(0)');
						thisComponent.createContactItem(targetGroup, item);
					});//end each
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
						.append($('<a/>').text(item.nickName)).append($('<span/>')).appendTo($group);
				}
			},
			/**
			 * 创建一对一的聊天对话，
			 * 返回新建的对话框(jQuery)对象
			 */
			createOne2OneChat : function(jid){
				//生成聊天对话框
				if(thisComponent.chatRoomDlgList[jid]){
					thisComponent.chatRoomDlgList[jid].dialog('open').dialog( "moveToTop" );
				}else{
					var nickName = thisComponent.getNickName(jid);
					var $chatRoomDlg = $('#xmppIM_chatDialog').clone(true).attr('id', 'xmppIM_chatDialog_'+jid).appendTo($('#xmppIM_chatDialog'));
					$('#xmppIM_targetJID', $chatRoomDlg).val(jid);
					$chatRoomDlg.find('div.userName').text(nickName);
					thisComponent.chatRoomDlgList[jid] = $chatRoomDlg;
					$chatRoomDlg.dialog({
						height : 340,
						width : 420,
						title : '与 '+nickName+' 聊天',
						resizable: false
					});
				}
				return thisComponent.chatRoomDlgList[jid];
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
			 * 获取联系人信息
			 */
			getEntry: function(jid){
				return thisComponent.roster.entries[jid];
			},
			/**
			 * 获取昵称
			 */
			getNickName : function(jid){
				var entry = thisComponent.getEntry(Strophe.getBareJidFromJid(jid));
				if(entry){
					return entry.nickName;
				}else{
					return jid;
				}
			},
			makeJID : function(userId){
				return userId + "@" + this.setting.domain + "/" + this.setting.resource;
			},
			/**
			 * 检查指定的jid是否已经注册
			 * <iq type='get'
				    from='lxp@viking'
				    to='small@viking'
				    id='info2'>
				  <query xmlns='http://jabber.org/protocol/disco#info'/>
				</iq>
			 */
			checkUserRegister : function(jid){
				var queryIQ = $iq({type: 'get', from:thisComponent.curUserJid, to: jid}).c('query', {xmlns: Strophe.NS.DISCO_INFO});
				thisComponent.connection.sendIQ(queryIQ.tree(), function(iq){
					console.log('已注册');
				}, function(iq){
					console.log('没注册');
				});
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