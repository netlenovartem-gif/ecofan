initPage();

ymaps.ready(function () {
  var myMap = new ymaps.Map('map', {
    center: [56.3269, 44.0059],
    zoom: 12
  });

  api('/api/points').then(function (points) {
    points.forEach(function (p) {
      var placemark = new ymaps.Placemark([p.lat, p.lng], {
        balloonContent:
          '<strong>' + p.name + '</strong><br>' +
          p.address + '<br>' +
          p.hours + '<br>' +
          'Принимает: ' + p.accepts
      }, {
        preset: 'islands#greenIcon'
      });

      myMap.geoObjects.add(placemark);
    });

    document.getElementById('points-list').innerHTML = points.map(function (p) {
      return '<li><span><strong>' + p.name + '</strong><br>' +
             p.address + '<br>' + p.hours + '<br>' +
             'Принимает: ' + p.accepts + '</span></li>';
    }).join('');
  });
});