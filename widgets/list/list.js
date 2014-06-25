
define(function() {

	return function() {
		var self = this;

		return self.hook(
			{
				"htm": "./" + self.widget.id + ".htm"
			},
			{
				"service-files": "http://log." + window.API.config.hostname + "/service/list",
				"incoming-ips": "http://log." + window.API.config.hostname + "/incoming/ip/list"
			},
			[
				{
					resources: [ "htm" ],
					streams: [ "service-files", "incoming-ips"],
					handler: function(_htm, _service_files, _incoming_ips) {

						_service_files.on("data", function(files) {
							return self.setHTM(_htm, {
								files: files
							});
						});

						_incoming_ips.on("data", function(ips) {
console.log("ips", ips);
//							return self.setHTM(_htm, {
//								files: files
//							});
						});




/*
						 // **Item class**: The atomic part of our Model. A model is basically a Javascript object, 
						 // i.e. key-value pairs, with some helper functions to handle event triggering, persistence, etc.
						  var DB_Item_IP = Backbone.Model.extend({});

						  // **List class**: A collection of `Item`s. Basically an array of Model objects with some helper functions.
						  var List = Backbone.Collection.extend({
						    model: DB_Item_IP
						  });

						  var ListView = Backbone.View.extend({
						    el: self.tag,
						    events: {
//						      'click button#add': 'addItem'
						    },
						    // `initialize()` now instantiates a Collection, and binds its `add` event to own method `appendItem`. (Recall that Backbone doesn't offer a separate Controller for bindings...).
						    initialize: function(){
						      _.bindAll(this, 'render', 'appendItem'); // remember: every function that uses 'this' as the current object should be in here

						      this.collection = new List();
						      this.collection.bind('add', this.appendItem); // collection event binder

						      this.counter = 0;
						      this.render();
						    },
						    render: function(){
						      // Save reference to `this` so it can be accessed from within the scope of the callback below
						      var self = this;
						      $(this.el).append("<ul></ul>");

						    },
						    // `appendItem()` is triggered by the collection event `add`, and handles the visual update.
						    appendItem: function(item) {
						      $('ul', this.el).append("<li>"+item.get('ip')+"</li>");
						    }
						  });

						  var listView = new ListView();


						_incoming_ips.on("data", function(ips) {
console.log("ips", ips);

console.log("listView.collection", listView.collection);

							ips.forEach(function(ip) {
								var item = new DB_Item_IP();
								item.set({
									ip: ip
								});
								listView.collection.add(item);
							});


//							return self.setHTM(_htm, {
//								files: files
//							});
						});
*/

						return self.API.Q.resolve();
					}
				}
			]
		);
	};
});
