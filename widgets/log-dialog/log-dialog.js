
define(function() {

	return function() {
		var self = this;

		function showLogDialog (type, id, options) {

		}

		return self.hook(
			{
				"htm": "./" + self.widget.id + ".htm"
			},
			{
			},
			[
				{
					resources: [ "htm" ],
					handler: function (_htm) {
						return self.setHTM(_htm).then(function(tag) {

							$('#modal-viewer-rawlog', tag).modal({
								show: false
							});
							
							$('#modal-viewer-rawlog', tag).on('show.bs.modal', function () {
								$('#modal-viewer-rawlog .modal-body', tag).css('height', $(window).height() - 160);
							});

							var tagContent = null;
							try {
								tagContent = JSON.parse(self.tagContent);
							} catch (err) {
								console.log("self.tagContent", self.tagContent);
								console.log("Error parsing json:", err.stack);
							}

							$('[x-widget="io.pinf.server.log/log-viewer"]', self.tag)[0]._firewidget.api.showRawLogDialog(tagContent.type, tagContent.logPath, {
								updateUrlHash: tagContent.updateUrlHash || false,
								height: $(window).height() - 160,
								titleNode: $("#modal-viewer-rawlog .modal-title", self.tag),
								buttons: {
									close: false
								}
							});

							$('#modal-viewer-rawlog').modal({
								show: true
							});

							return tag;
						});
					}
				}
			]
		);
	};
});
