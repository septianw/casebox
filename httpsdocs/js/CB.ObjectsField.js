//ObjectsComboField
//ObjectsTriggerField
	//ObjectsSelectionForm
	//ObjectsSelectionPopupList

CB.ObjectsFieldCommonFunctions = {
	getStore: function(){
		if( Ext.isEmpty(this.config.source) || (this.config.source == 'thesauri') ) this.store = this.getThesauriStore();
		else{
			//try to access object window to locate objects store
			
			this.objectsStore = this.getObjectsStore();

			this.store = new Ext.data.DirectStore({
				autoLoad: false //true
				,autoDestroy: true
				,restful: false
				,baseParams: this.config
				,proxy: new Ext.data.DirectProxy({
					paramsAsHash: true
					,api: { read: Browser.getObjectsForField }
					,listeners:{
						load: function(proxy, obj, opt){
							for (var i = 0; i < obj.result.data.length; i++) obj.result.data[i].date = date_ISO_to_date(obj.result.data[i].date);
						}
					}
				})
				,reader: new Ext.data.JsonReader({
					successProperty: 'success'
					,root: 'data'
					,messageProperty: 'msg'
				},[ 
					{name: 'id', type: 'int'}
					,'name'
					,{name: 'date', type: 'date'}
					,{name: 'type', type: 'int'}
					,{name: 'subtype', type: 'int'}
					,{name: 'template_id', type: 'int'}
					,{name: 'status', type: 'int'}
					, 'iconCls'
				]
				)
				,listeners: {
					scope: this
					,load: 	function(store, recs, options) {
						Ext.each(recs, function(r){r.set('iconCls', getItemIcon(r.data))}, this);
					}

				}
			})
		}
		if(Ext.isEmpty(this.store)) this.store = new Ext.data.ArrayStore({ idIndex: 0, fields: [{name: 'id', type: 'int'}, 'name'], data:  [] });
		this.store.getTexts = getStoreNames;		
	}
	,getObjectsStore: function(){
		if( Ext.isEmpty(this.config.source) || (this.config.source == 'thesauri') ) return this.getThesauriStore();

		if(Ext.isEmpty(this.data)) return;
		if(this.data.ownerCt) return this.data.ownerCt.objectsStore;
		if(this.data.grid) {
			a = this.data.grid.findParentByType(CB.Objects);
			if(!Ext.isEmpty(a)) return a.objectsStore;
		}
	}
	,getThesauriStore: function(){
		thesauriId = this.config.thesauriId;
		if(this.config.thesauriId == 'variable'){
			pri = this.data.record.store.findBy(function(r){
				return ( (r.get('id') == this.data.record.get('pid')) && (r.get('duplicate_id') == this.data.record.get('duplicate_id')) );}, this);
			if(pri > -1) thesauriId = this.data.pidValue;
		}
		if(!isNaN(thesauriId)) return getThesauriStore(thesauriId);
	}

}
CB.ObjectsComboField = Ext.extend(Ext.form.ComboBox, {
	forceSelection: true
	,triggerAction: 'all'
	,lazyRender: true
	,mode: 'remote'
	,editable: true
	,displayField: 'name'
	,valueField: 'id'
	,minChars: 3
	,data: {}
	,initComponent: function(){
		CB.ObjectsComboField.superclass.initComponent.call(this);
		Ext.apply(this, CB.ObjectsFieldCommonFunctions);
		this.store = [];
		this.config = {}
		if(this.data.record) this.config = Ext.value(this.data.record.get('cfg'), {});
		this.getStore();
		mode = 'local'
		if(this.store.proxy){
			mode = 'remote'
			this.store.on('beforeload', this.onBeforeLoadStore, this);
			this.store.on('load', this.onStoreLoad, this);
			this.store.load();
		}
		customIcon = (this.config.renderer == 'listGreenIcons') ? 'icon-element' : '';
		Ext.apply(this, {
			mode: mode
			,store: this.store
			,iconClsField: 'iconCls'
			,customIcon: customIcon
			,plugins: [new Ext.ux.plugins.IconCombo()]
			,listeners: {
				scope: this
				,beforeselect: function( combo, record, index){
					if(Ext.isEmpty(this.objectsStore)) return;
					idx = this.objectsStore.findExact('id', record.get('id'));
					clog(record.data);
					if(idx < 0) this.objectsStore.loadData({data: [record.data]}, true);
				}
			}
		})
		
		this._setValue = this.setValue
		this.setValue = function(v){
			if(!Ext.isEmpty(v)) v = parseInt(v);
			clog(v);
			this._setValue(v);
			this.setRawValue(this.store.getTexts(v));
		}
		CB.ObjectsComboField.superclass.initComponent.apply(this, arguments);
	}
	,onBeforeLoadStore: function(st, options){ 
		options = this.config;
		st.baseParams= options
	}
	,onStoreLoad: function(store, recs, options) {
		Ext.each(recs, function(r){r.set('iconCls', getItemIcon(r.data))}, this);
		store.insert( 0, new store.recordType({id: null, name:''}, Ext.id()) );
		this.setValue(this.getValue());
	}
	,updateStore: function(){
		clog('this', this);
		oldStore = this.store;
		this.getStore();
		this.bindStore(this.store);
		clog(this.store);
		if(oldStore) oldStore.destroy();
	}
});

Ext.reg('CBObjectsComboField', CB.ObjectsComboField);

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
CB.ObjectsTriggerField = Ext.extend(Ext.Panel, {
	bodyStyle: 'border: 1px solid #b5b8c8'
	,cls: 'x-form-field'
	,isFormField: true
	,delimiter: '<br />'
	,initComponent: function(){
		CB.ObjectsTriggerField.superclass.initComponent.call(this);
		//listeners = Ext.value(this.listeners, {});
		//Ext.apply(listeners, {scope: this, change: this.onTagsChange});
		this.config = {}
		if(this.data.record) this.config = Ext.value(this.data.record.get('cfg'), {});
		
		this.triggerIconCls = 'icon-element';
		tpl = '<tpl for=".">{[ (xindex == 0) ? "" : "'+this.delimiter+'"]}{name}</tpl>'
		clog('this.data.record.data.cfg.renderer', this.data.record.data.cfg.renderer)
		switch(this.data.record.data.cfg.renderer){
			case 'listGreenIcons': 
					tpl = '<ul><tpl for="."><li class="icon-padding16 icon-element">{name}</li></tpl></ul>';
					this.triggerIconCls = 'icon-element';
					break;
			case 'listObjIcons':
					tpl = '<ul><tpl for="."><li class="icon-padding16 {iconCls}">{name}</li></tpl></ul>';
					this.triggerIconCls = 'icon-arrow-split-090'
					break;
		}

		Ext.apply(this, CB.ObjectsFieldCommonFunctions);

		this.trigger = new Ext.Button({
			iconCls: this.triggerIconCls
			,cls:'fR '
			,style: 'margin:-1px -2px '
			,scope: this
			,handler: this.onTriggerClick
		});
		
		
		this.dataView = new Ext.DataView({
			emptyText: L.empty
			,overCls: 'field-over'
			,itemSelector: 'li'
			,style: 'margin: 3px; white-space: normal'
			,tpl: tpl
			,data: []
		});
		
		Ext.apply(this, {
			items: [this.trigger, this.dataView]
			,listeners:{
				scope: this
				,afterrender: this.afterrender
			}
		})

		CB.ObjectsTriggerField.superclass.initComponent.apply(this, arguments);
		this.addEvents('change');
	}
	,afterrender: function(){ 
		this.setValue(this.value);
	}
	,setValue: function(v){
		this.value = [];
		store = this.getObjectsStore();
		clog('setting_value', v, store);
		if(!Ext.isEmpty(v)){
			if(!Ext.isArray(v)) v = String(v).split(',');
			for(i = 0; i < v.length; i++) this.value.push(parseInt(v[i]));
		}
		data = [];
		for (var i = 0; i < this.value.length; i++) {
			idx = store.findExact('id', this.value[i]);
			if(idx >=0){
				r = store.getAt(idx);
				data.push(r.data);
			}
		};
		clog('data', data)
		if(this.dataView.rendered) this.dataView.update(data); else this.dataView.data = data;
	}
	,getValue: function(){ 
		clog('twin value', this.value);
		return this.value.join(',')}
	,onTriggerClick: function(e){
		if( Ext.isEmpty(this.config.source) || (this.config.source == 'thesauri') ){
			this.form = new CB.ObjectsSelectionPopupList({
				data: this.data
				,value: this.getValue()
				,listeners:{
					scope: this
					,setvalue : this.onSetValue
				}
			});
		}else this.form = new CB.ObjectsSelectionForm({
				data: this.data
				,value: this.getValue()
				,listeners:{
					scope: this
					,setvalue : this.onSetValue
				}
			});
		this.form.show();
	}
	,onSetValue: function(data){
		if(!Ext.isString(data)){
			selectedValue = [];
			Ext.each( data, function(i){
				selectedValue.push(i.id);
			}, this );
			data = selectedValue.join(',');

		}

		oldValue = this.getValue();
		if(data == oldValue) return;
		this.setValue(data);
		this.fireEvent('change', data, oldValue);
	}
});
Ext.reg('CBObjectsTriggerField', CB.ObjectsTriggerField);

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
CB.ObjectsSelectionForm = Ext.extend(Ext.Window, {
	height: 400
	,width: 500
	,modal: true
	,layout: 'border'
	,title: L.Associate
	,config: {
		multiValued: false
	}
	,initComponent: function(){
		CB.ObjectsSelectionForm.superclass.initComponent.call(this);
		this.config = {}
		if(this.data.record) this.config = Ext.value(this.data.record.get('cfg'), {});

		Ext.apply(this, CB.ObjectsFieldCommonFunctions);
		this.getStore();
		// this.store.on('beforeload', this.onBeforeLoadStore, this);
		// this.store.on('load', this.onStoreLoad, this);

		// this.store = new Ext.data.DirectStore({
		// 	autoLoad: false
		// 	,autoSave: false
		// 	,autoDestroy: true
		// 	,restful: false
		// 	,proxy: new  Ext.data.DirectProxy({
		// 		paramsAsHash: true
		// 		,api: { read: Search.searchObjects }
		// 		,listeners:{
		// 			scope: this
		// 			,load: function(proxy, obj, opt){
		// 				for (var i = 0; i < obj.result.data.length; i++) obj.result.data[i].date = date_ISO_to_date(obj.result.data[i].date);
		// 			}
		// 		}
		// 	})
		// 	,reader: new Ext.data.JsonReader({
		// 		successProperty: 'success'
		// 		,idProperty: 'id'
		// 		,root: 'data'
		// 		,messageProperty: 'msg'//, dateFormat: 'Y-m-d H:i:s'
		// 	},[ {name:'id', type: 'int'}, 'name', {name: 'date', type: 'date'}, {name:'type', type: 'int'}, {name:'subtype', type: 'int'}, {name:'status', type: 'int'}, {name:'template_id', type: 'int'}, 'iconCls', 'sys_tags', 'user_tags', 'body']
		// 	)
		// 	//,writer: new Ext.data.JsonWriter({encode: false, writeAllFields: true})
		// 	,listeners:{
		// 		scope: this
		// 		,beforeload: this.onBeforeLoad
		// 		,load: this.onLoad
		// 	}
		// });

		columns = [
			{dataIndex: 'name', scope: this, renderer: function(v, m, r, ri, ci, s){ 
				switch(this.config.renderer){
					case 'listGreenIcons': m.css = 'icon-grid-column icon-element'; break;
					case 'listObjIcons': m.css = 'icon-grid-column '+r.get('iconCls'); break;
				}
				a = String(r.get('sys_tags')).split(',');
				t = [];
				Ext.each(a, function(i){t.push(CB.DB.thesauri.getName(i))}, this);
				if(!Ext.isEmpty(t)) v += ' <span class="cG">' + t.join(', ') + '</span>'; 
				//v += '<img class="open-object icon-information-white fr click" src="css/i/s.gif"/>'
				return v;
				}
			}
		]
		if(this.config.showDate == true) columns.push({dataIndex: 'date', width: 50, renderer: App.customRenderers.datetime})

		this.grid = new Ext.grid.GridPanel({
			stripeRows: true
			,region: 'center'
			,border: false
			,store: this.store
			,autoScroll: true
			,header: false
			,hideHeaders:true
			,colModel: new Ext.grid.ColumnModel({
				defaults: { sortable: true }
				,columns: columns
			})
			,viewConfig: { autoFill: true, forceFit: true, markDirty: false, headersDisabled: true }
			,sm: new Ext.grid.RowSelectionModel({ singleSelect: !this.config.multiValued })
			,listeners: {  
				scope: this
				,rowclick: this.onRowClick
				,rowdblclick: this.onSelectItemClick 
			}
			,bbar: new Ext.PagingToolbar({
				store: this.store       // grid and PagingToolbar using same store
				,displayInfo: true
				,hidden: true
			})
		});
		
		this.resultPanel = new Ext.DataView({
			region: 'south'
			,border: false
			,cls: 'bgcW btg p10'
			,autoHeight: true
			,hidden: !this.config.multiValued
			,tpl: new Ext.XTemplate(
				'<span class="fwB">'+L.Value+':</span><ul><tpl for=".">'
				,'<li class="lh20 icon-padding16 {iconCls}"> &nbsp; {name} <span style="display: inline-block; width: 14px"><span class="buttons"><a href="#" class="icon-close-light" style="display:inline-block; width: 20px;text-decoration: none" title="'+L.Remove+'">&nbsp; &nbsp;</a></span></span></li>'
				,'</tpl></ul>'
				,{compiled: true}
			)
			,store: new Ext.data.JsonStore({ fields: [ {name:'id', type: 'int'}, 'title', 'iconCls', 'sys_tags', 'user_tags' ] })
			,itemSelector: 'li'
			,overClass:'item-over'
			,listeners: { click: {scope: this, fn: this.onRemoveItemClick} } 
		});

		Ext.apply(this, {
			defaults: {border: false}
			,border: false
			,buttonAlign: 'left'
			,items:[ 
				{ xtype: 'panel'
					,region: 'center'
					,layout: 'border'
					,items: [
						{
							xtype: 'panel'
							,region: 'north'
							,height: 22
							,layout: 'hbox'
							,border: false
							,items: [
								{xtype: 'trigger'
									,anchor: '100%'
									,flex: 1
									,emptyText: L.Search
									,triggerClass: 'x-form-search-trigger'
									,enableKeyEvents: true
									,scope: this
									,onTriggerClick: function(){ 
										this.scope.onGridReloadTask(); }
									,listeners: {
										scope: this
										,specialkey: function(ed, ev){ if(ev.getKey() == ev.ENTER) this.onGridReloadTask()}
									}
								}
							]
						}
						,this.grid
						,this.resultPanel
					]
				}
			]
			,listeners: {
				scope: this
				,show: function(){
					if(this.config.autoLoad == true) this.onGridReloadTask();
					this.triggerField.focus(false, 400);
				}
				,facetchange: function(o, ev){ ev.stopPropagation(); this.onGridReloadTask(); }
				,beforedestroy: function(){ if(this.qt) this.qt.destroy()}
			}
			,buttons:[
				'->'
				,{text: Ext.MessageBox.buttonText.ok, iconCls: 'icon-tick', scope: this, handler: this.onOkClick}
				,{text: Ext.MessageBox.buttonText.cancel, iconCls: 'icon-cancel', scope: this, handler: this.destroy}]
		});
		CB.ObjectsSelectionForm.superclass.initComponent.apply(this, arguments);
		this.addEvents('setvalue');
		this.triggerField = this.findByType('trigger')[0];
	}
	,onGridReloadTask: function(){
		if(!this.gridReloadTask) this.gridReloadTask = new Ext.util.DelayedTask(this.processGridReload, this);
		this.gridReloadTask.delay(500);
	}
	,processGridReload: function(){
		searchParams = {};
		this.store.baseParams = searchParams;
		this.store.lastOptions = searchParams;
		this.store.reload(searchParams);
	}
	,onBeforeLoad: function(store, records, options){
		store.baseParams = this.getSearchParams();
		this.getEl().mask(L.searching);
	}
	,getSearchParams: function(){
		result = Ext.apply({}, this.config);
		result.query = this.triggerField.getValue();
		if(!Ext.isEmpty(this.config.pidValue)) result.pidValue = this.config.pidValue;
		if(!Ext.isEmpty(this.config.object_pid)) result.object_pid = this.config.object_pid;
		return result;
	}
	,onLoad: function(store, records, options){
		this.getEl().unmask();
		if(Ext.isEmpty(records)) this.grid.getEl().mask(L.noData);
		else{
			this.grid.getEl().unmask();
			Ext.each(records, function(r){ r.set('iconCls', getItemIcon(r.data)) }, this);
		}
		this.triggerField.setValue(options.params.query);
		this.grid.getBottomToolbar().setVisible(store.reader.jsonData.total > store.reader.jsonData.data.length);
	}
	,onSelectionChange: function(sm, selection){ 
		//this.buttons[0].setDisabled(!sm.hasSelection());
	}
	,onRowClick: function(g, ri, e){
		el = Ext.get(e.getTarget());
		if(!el || !el.hasClass('open-object')) return;
		r = g.getStore().getAt(ri);
		if(!this.qt)
			this.qt = new Ext.QuickTip({
				autoHeight: true
				,autoWidth: true
				,autoHide: true
				,dismissDelay: 0
				,closable: true
				,draggable: true
				,target: this
				,cls: 'fs11'
				,iconCls: r.get('iconCls')
				,headerCfg:{
					cls: 'icon-padding'
					,style:'height:20px'
				}
				,title: r.get('title')
				,html: '<span class="icon-padding icon-loading">'+L.LoadingData+'</span>'
			});
		else {
			this.qt.hide();
			this.qt.setTitle(r.get('title'), r.get('iconCls'));
			if(this.qt.contact_id != r.get('id')) this.qt.update('<span class="icon-padding icon-loading">'+L.LoadingData+'</span>');
		}
		this.qt.showAt(e.getXY());
	}
	,onSelectItemClick: function(g, ri, e){
		r = g.getStore().getAt(ri);
		idx = this.resultPanel.store.findExact('id', r.get('id'));
		if(this.config.multiValued){
			if(idx > -1) this.resultPanel.store.removeAt(idx);
			else{
				var u = new this.resultPanel.store.recordType(r.data);
				this.resultPanel.store.add(u);
			}
			this.items.last().syncSize();
		}else  this.onOkClick();
	}
	,onRemoveItemClick: function(b, idx, oel, e){
		el = Ext.get(e.getTarget());
		if(!el.dom.classList.contains('icon-close-light')) return;
		this.resultPanel.store.removeAt(idx);
		//this.buttons[2].setDisabled(false);
		this.items.last().syncSize();
	}
	,getValue: function(){
		rez = [];
		this.resultPanel.store.each(function(r){ rez.push(r.data.id) }, this);
		return rez.join(',');
	}
	,setData: function(data){
		if(!this.config.multiValued) return;
		if(Ext.isEmpty(data)) data = [];
		this.resultPanel.store.removeAll();
		Ext.each(data, function(d){
			d.id = parseInt(d.id);
			u = new this.resultPanel.store.recordType(d);
			this.resultPanel.store.add(u);
		}, this);
		
		//this.buttons[2].setDisabled(true);
		if(this.rendered) this.items.last().syncSize();
	}
	,getData: function(){
		rez = [];
		this.resultPanel.store.each(function(r){ rez.push(r.data) }, this);
		return rez;
	}
	,onOkClick: function(){
		if(!this.config.multiValued){
			this.resultPanel.store.removeAll();
			r = this.grid.getSelectionModel().getSelected();
			if(r){
				u = new this.resultPanel.store.recordType(r.data);
				this.resultPanel.store.add(u);
			}
		}
		newValue = this.getData();
		objStore = this.getObjectsStore();
		if(objStore) Ext.each(newValue, function(d){ objStore.checkRecordExistance(d)}, this)
		this.fireEvent('setvalue', newValue, this);
		this.close();
	}
});
Ext.reg('CBObjectsSelectionForm', CB.ObjectsSelectionForm);

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
CB.ObjectsSelectionPopupList = Ext.extend(Ext.Window, {
	bodyBorder: false
	,closable: true
	,closeAction: 'destroy'
	,hideCollapseTool: true
	,layout: 'fit'
	,maximizable: false
	,minimizable: false
	,modal: true
	,plain: true
	,stateful: true
	,value: []
	,title: L.ChooseValues
	,store: new Ext.data.ArrayStore({autoDestory: true, idIndex: 0, fields: [{name:'id', mapping: 0}, {name: 'name', mapping: 1}] ,data: []})
	,minWidth: 350
	,minHeight: 250
	,height: 350
	,initComponent: function(){
		CB.ObjectsSelectionPopupList.superclass.initComponent.apply(this, arguments);
		if(this.data && this.data.record) this.config = Ext.value(this.data.record.get('cfg'), {});
		Ext.apply(this, CB.ObjectsFieldCommonFunctions);
		this.getStore();
		this.cm = [{
				header:' '
				,dataIndex: 'id'
				,width: 15
				,fixed: true
				,resizable: false
				,scope: this
				,renderer: function(value, metaData, record, rowIndex, colIndex, store){
					if(record.get('header_row') == 1) return;
					metaData.css = (this.value.indexOf(value+'') >= 0) ? 'icon-element': 'icon-element-off'
				}
			},{
				header: L.Value
				,dataIndex: 'name'
				,width: 270
				,renderer: function(value, metaData, record, rowIndex, colIndex, store) {
					metaData.css = 'wsn '+ (record.get('icon') ? record.get('icon') + ' icon-padding' : '');
					return value;
				}
			}
		];
		if(!Ext.isEmpty(this.config.showDate))
			this.cm.push({
				header: L.Date
				,width: 60
				,dataIndex: this.config.showDate
				,format: App.dateFormat
				,renderer: App.customRenderers.date
			})

		this.trigger = new Ext.form.TriggerField({	
				triggerClass: 'x-form-search-trigger'
				,border: false
				,emptyText: L.Filter
				,enableKeyEvents: true
				,onTriggerClick: function(e){this.doFilter(e)}.createDelegate(this)
				,tabIndex: 1
				,listeners: {
					scope: this
					,keyup: function(f,e){ 
						this.doFilter(e);
					}
					,specialkey: function(f,e){
						switch(e.getKey()){
							case e.DOWN:
							case e.TAB: this.focusGrid(); break;
							case e.ENTER:  f.onTriggerClick() 
						}
					}
				}
			})
		
		this.grid = new Ext.grid.GridPanel({	
			border: false
			,style: 'background-color: white'
			,stripeRows: true
			,store: this.store
			,minColumnWidth: 5
			,columns: this.cm
			,tbar: [this.trigger]
			,viewConfig: {
				forceFit: true
				,enableRowBody: true
				,getRowClass: function(r, rowIndex, rp, ds){
					rp.body = (r.get('header_row') == 1) ? r.get('name') : '';
					return (rp.body ? 'x-grid3-row-with-body' : '');
				}
			}
			,hideHeaders: true
			,sm: new Ext.grid.RowSelectionModel({singleSelect: true})
			,tabIndex: 2
			,listeners:{
				scope: this
				,rowclick: this.toggleElementSelection
				,keypress: function(e){
					if( (e.getKey() == e.SPACE) && (!e.hasModifier())){
						e.stopPropagation();
						this.toggleElementSelection();
					}
				}
			}
		 });
		
		Ext.apply(this, {
			buttonAlign: 'left'
			,items: this.grid
			,keys:[{
					key: "\r\n"
					,fn: this.doSubmit
					,scope: this
				},{
					key: Ext.EventObject.ESC
					,fn: this.doClose
					,scope: this
				}
			]
			,buttons: [	
				{text: L.ClearSelection, handler: this.doClearSelection, scope: this, tabIndex: 6}
				,'->'
				,{text: Ext.MessageBox.buttonText.ok, handler: this.doSubmit, scope: this, tabIndex: 3}
				,{text: Ext.MessageBox.buttonText.cancel, handler: this.doClose, scope: this, tabIndex: 4}
			]
		});
		CB.ObjectsSelectionPopupList.superclass.initComponent.call(this);
		this.addEvents('setvalue');
		
		this.on('beforeshow', this.onBeforeShowEvent, this);
		this.on('resize', function(win, w, h){this.trigger.setWidth(w - 17)});
	}
	,focusGrid: function(){
		this.grid.focus();
		if(this.grid.getStore().getCount() > 0){
			r = this.grid.getSelectionModel().getSelected();
			if(!r) r = this.grid.getStore().getAt(0);
			this.grid.getSelectionModel().selectRecords([r]);
			this.grid.getView().focusRow(this.grid.getStore().indexOf(r));
		}
	}
	,toggleElementSelection: function(g, ri, e){
		r = this.grid.getSelectionModel().getSelected();
		if(!r || (r.get('header_row') == 1)) return;
		id = r.get('id') + '';
		if(this.value.indexOf(id) < 0 ) this.value.push(id);
		else this.value.remove(id);
		this.grid.getView().refresh(false);
		this.grid.getView().focusRow(this.grid.getStore().indexOf(r));
	}
	,onBeforeShowEvent: function(){
		this.trigger.setValue('');
		this.trigger.focus(true, 350);
		clog('initial', this.value);
		if(!Ext.isArray(this.value)) this.value = Ext.isEmpty(this.value) ? [] : String(this.value).split(',');
		clog('opened with value', this.value);
		this.doFilter();
		this.setTitle(this.title);
		if(this.iconCls)  this.setIconClass(this.iconCls);
		this.width = 350 + (this.grid.getColumnModel().getColumnCount() - 2) * 100;
		this.setWidth(this.width);
	},doFilter: function(e){
		criterias = [{fn: function(rec){return !Ext.isEmpty(rec.get('id'))}, scope: this}];
		v = this.trigger.getValue();
		if(!Ext.isEmpty(v)) criterias.push({ property: 'name', value: v, anyMatch: true, caseSensitive: false });
		if(Ext.isEmpty(criterias)) this.grid.store.clearFilter(); else this.grid.store.filter(criterias);
	},doClearSelection: function(){
		this.value = [];
		this.grid.getView().refresh(false);
	},doSubmit: function(){
		this.grid.store.clearFilter();
		newValue = this.value.join(',');
		this.fireEvent('setvalue', newValue, this);
		this.close();
	}

});
Ext.reg('CBObjectsSelectionPopupList', CB.ObjectsSelectionPopupList);