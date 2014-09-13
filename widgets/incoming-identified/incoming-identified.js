
define(function() {

	return function() {
		var self = this;

		// TODO: Match this better so you can customize more than just the header.
		var header = (self.tagContent && /<tr>/.test(self.tagContent) && self.tagContent) || null;


		return self.hook(
			{
				"htm": "./" + self.widget.id + ".htm"
			},
			{
				"identities": "http://io-pinf-server-log." + window.API.config.hostname + ":8013/incoming/identity/list",
			},
			[
				{
					resources: [ "htm" ],
					streams: [ "identities"],
					handler: function(_htm, _identities) {

						var activeFilter = null;
						self.setFilter = function(filter) {
							activeFilter = filter;
							_identities.setFilter(activeFilter);
						}

						_identities.on("data", function(records) {
							for (var id in records) {
								records[id].$display = JSON.parse(JSON.stringify(records[id]));
								records[id].$display.active = Math.floor((Date.now()-records[id].updatedOn)/1000/60) + " min";
								records[id].$display.platform = records[id].platform || "";
								records[id].$display.device = records[id].device || "";
								records[id].$display.instance = records[id].instance || "";
								records[id].$display.identity = records[id].identity || "";
							}
							return self.setHTM(_htm, {
								records: records,
								header: header
							}).then(function (tag) {
								$("TR", tag).click(function(event) {
									var row = null;
									while ((row = ((row && row.parent()) || $(event.target)))) {
										if (row.length === 0) break;
										if (row[0].nodeName === "BUTTON") return;
										if (row.attr("record-id")) break;
									}
									return self.parent.api.showRawLogDialog("incoming", row.attr("record-id"));
								});
								return tag;
							});
						});

						return self.API.Q.resolve();
					}
				}
			]
		);
	};
});
