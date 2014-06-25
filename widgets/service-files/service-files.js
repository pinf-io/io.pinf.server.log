
define(function() {

	return function() {
		var self = this;

		return self.hook(
			{
				"htm": "./" + self.widget.id + ".htm"
			},
			{
				"files": "http://log." + window.API.config.hostname + "/service/list",
			},
			[
				{
					resources: [ "htm" ],
					streams: [ "files"],
					handler: function(_htm, _files) {
						_files.on("data", function(records) {

							for (var id in records) {
								var record = records[id];

								record.$display = JSON.parse(JSON.stringify(record));

								// TODO: This should be done by data renderers.
								record.$display.active = Math.floor((Date.now()-record.updatedOn)/1000/60) + " min";;
								record.$display.size = record.size || "";
								record.$display.namespace = id;
								record.$display.alerts = "";
							}

							return self.setHTM(_htm, {
								records: records
							}).then(function(tag) {
								$("TR", tag).click(function() {
									var row = null;
									while ((row = ((row && row.parent()) || $(event.target)))) {
										if (row.length === 0) break;
										if (row[0].nodeName === "BUTTON") return;
										if (row.attr("record-id")) break;
									}
									return self.parent.api.showRawLogDialog("service", row.attr("record-id"));
								});
							});
						});

						return self.API.Q.resolve();
					}
				}
			]
		);
	};
});
