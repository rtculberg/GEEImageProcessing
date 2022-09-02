/*
Author: Riley Culberg
Date: 06/27/2022
*/

/*Load the shapefile containing the collection of catchment areas for each ice blob - update this in GEE by importing 
the provided shapefile */
var table = ee.FeatureCollection("users/culberg/NWIceSlab"),
    table2 = ee.FeatureCollection("users/culberg/Subset1"),
    table3 = ee.FeatureCollection("users/culberg/Subset2"),
    table4 = ee.FeatureCollection("users/culberg/Subset3"),
    table5 = ee.FeatureCollection("users/culberg/Subset4");

var point = ee.Geometry.Point([-55.40004,74.70639]);
var data = ee.ImageCollection('LANDSAT/LE07/C01/T1_TOA');

// Calculate NDWI and do initial cloud masking
var addNDWI = function(image){
  var cloud = ee.Algorithms.Landsat.simpleCloudScore(image).select('cloud');
  var mask = cloud.lte(5);
  var ndwi = image.normalizedDifference(['B1','B3']).rename('NDWI');
  return image.addBands(ndwi).updateMask(mask);
}

var filtered_data = data.filterBounds(table)
                    .filter(ee.Filter.calendarRange(2000,2012,'year'))
                    .filter(ee.Filter.calendarRange(7,8,'month'))
                    .filterMetadata('CLOUD_COVER','less_than',10);
var ndwi = filtered_data.map(addNDWI);
var max = ndwi.max();

Map.centerObject(table,6);
var ndwiParams = {bands: ['NDWI'], min:-1, max:1, palette:['red','white','blue']};
var visParams = {bands:['B3','B2','B1'], max: 0.3};
var quality = {bands:['BQA']};
Map.addLayer(max, ndwiParams, 'NDWI Images');
Map.addLayer(table);

Export.image.toDrive({
  image: max.select('NDWI'),
  description: 'NDWI_max1_L7',
  scale: 30,
  region: table2
});

Export.image.toDrive({
  image: max.select('NDWI'),
  description: 'NDWI_max2_L7',
  scale: 30,
  region: table3
});

Export.image.toDrive({
  image: max.select('NDWI'),
  description: 'NDWI_max3_L7',
  scale: 30,
  region: table4
});

Export.image.toDrive({
  image: max.select('NDWI'),
  description: 'NDWI_max4_L7',
  scale: 30,
  region: table5
});