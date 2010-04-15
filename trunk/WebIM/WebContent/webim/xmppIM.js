// JavaScript Document
(function($) {
	IS_DEBUG = false;
	
	$.fn.xmppIM = function(opts) {
		return this.each(function() {
			if(!$.fn.xmppIM.component){
				var conf = $.extend( {}, opts);			
				$.fn.xmppIM.component = xmppIM_component();
				$.fn.xmppIM.component.init(this, conf);
			}
		});
	};
	$.fn.xmppIM.component = false;
	$.fn.xmppIM.defaults = {
		service : '/http-bind/',
		path : 'webim',
		resource: 'webim',
		domain: 'viking',
		workspaceClass : 'xmppIMPanel'
	};
	$.fn.xmppIM.NS = {
			IQ_ROSTER : 'jabber:iq:roster'	
	};
	function xmppIM_component() {
		return {
			connection : {},
			container : {},			
			setting : $.extend( {}, $.fn.xmppIM.defaults),
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
				var _this = this;				
				this.container.load(this.setting.path + '/html/login.html');
				this.container.dialog( {
					buttons : {
						"登陆" : function() {
							var userId = _this.makeJID($('#xmppIM_login_userId').val());
							var password = $('#xmppIM_login_password').val();
							_this.connection.connect(userId, password, _this.onConnect);
						}
					},
					height : 500,
					width : 240,
					title : 'WEB IM'
				});
			},
			/**
			 * 连接状态回调函数
			 */
			onConnect : function(status){
				var component = $.fn.xmppIM.component;
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
					//处理函数、namespace 、包名、包的type属性、包id、包的from属性、options
					component.attachHandler.call(component);
					component.initWorkspace.call(component);
					
					//发送在线的Presence
					component.connection.send($pres().tree());
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
				this.connection.addHandler(this.handleRoster, $.fn.xmppIM.NS.IQ_ROSTER, 'iq', null, null, null);
			},
			/**
			 * 登陆成功后初始化IM界面
			 */
			initWorkspace : function(){
				var _this = this;
				this.container.load(this.setting.path + '/html/workspace.html', function(){
					$('#xmppIM_contactPanel').tabs();
					
					//<iq type="get" id="sd4"><query xmlns="jabber:iq:roster"/></iq>
					var queryRoster = $iq({type: 'get'}).c('query', {xmlns: $.fn.xmppIM.NS.IQ_ROSTER});
					_this.connection.send(queryRoster.tree());
				});
			},
			/**
			 * 处理短消息
			 */
			onMessage : function(msg){
				console.log(msg);
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
			handleRoster : function(iq){
				console.log(iq);
				var groupList = {};
				var groupTemplate = $('#xmppIM_defaultContact_Group').clone();//先复制一个用作模板
				$(iq).find('item').each(function(){
					var $this = $(this);
					var group = $this.children('group');
					var nickName = $this.attr('name') ? $this.attr('name') : $this.attr('jid');
					var targetGroup; //当前item应该加到哪个group里
					if(group.length > 0){ //检查是否有分组
						var $group = groupList[group.text()] ? groupList[group.text()] : $('#'+Base64.encode(group.text()));
						if($group.length == 0){//检查是否已建了该分组
							$group = groupTemplate.clone().attr('id', Base64.encode(group.text()))
										.prependTo('#xmppIM_contactList')
										.find('a[type="xmppIM_contactGroup_Header"]:eq(0)').text(group.text()).end();
							groupList[group.text()] = $group;
						}
						targetGroup = $group.find('ul:eq(0)');
					}else{
						targetGroup = $('#xmppIM_defaultContact_Group').find('ul:eq(0)');
					}
					$('<li/>').attr('id', $this.attr('jid')).addClass('user').append($('<a/>').text(nickName)).appendTo(targetGroup);
				});
				//设置分组头点击事件
				$('#xmppIM_contactList').find('a[type="xmppIM_contactGroup_Header"]').click(function(){
					$(this).siblings('ul').toggle();
				});
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