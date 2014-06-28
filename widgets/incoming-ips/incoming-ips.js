
define(function() {

	return function() {
		var self = this;

		return self.hook(
			{
				"htm": "./" + self.widget.id + ".htm"
			},
			{
				"ips": "http://io-pinf-server-log." + window.API.config.hostname + ":8013/incoming/ip/list",
			},
			[
				{
					resources: [ "htm" ],
					streams: [ "ips"],
					handler: function(_htm, _ips) {

						_ips.on("data", function(records) {
							for (var id in records) {
								records[id].$display = JSON.parse(JSON.stringify(records[id]));
								records[id].$display.active = Math.floor((Date.now()-records[id].updatedOn)/1000/60) + " min";
								records[id].$display.device = records[id].device || "";
								if (records[id].meta) {
									records[id].$display.meta = '<button type="button" class="btn btn-primary btn-xs button-meta">' + JSON.stringify(records[id].meta).length + ' chars</button>';
								} else {
									records[id].$display.meta = '';
								}
							}
							return self.setHTM(_htm, {
								records: records
							}).then(function (tag) {
								$("BUTTON.button-meta", tag).click(function(event) {
									var row = null;
									while ((row = ((row && row.parent()) || $(event.target)))) {
										if (row.length === 0 || row.attr("record-id")) break;
									}
									return self.parent.api.showMetaDialog(records[row.attr("record-id")].meta);
								});

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
