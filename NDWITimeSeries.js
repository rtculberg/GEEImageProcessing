/*
Author: Riley Culberg
Date: 06/26/2022


*/

/*Load the shapefile containing the collection of catchment areas for each ice blob - update this in GEE by importing 
the provided shapefile */
var table = ee.FeatureCollection("users/culberg/NDWICatchments");

// Access the lANDSAT image collection
var data = ee.ImageCollection('LANDSAT/LE07/C01/T1_TOA');
// var data = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA'); // Uncomment to load Landsat8 instead of Landsat7

// Calculate NDWI and do initial cloud masking
var addNDWI = function(image){
  var cloud = ee.Algorithms.Landsat.simpleCloudScore(image).select('cloud');  // Basic cloud mask
  var mask = cloud.lte(5);
  var ndwi = image.normalizedDifference(['B2','B4']).rename('NDWI');  //NDWI calculation
  // B2-B4 for Landsat 8 if using NDWI_ice
  // B1-B3 for Landsat 7 if using NDWI_ice
  // B3-B5 for Landsat 8 if using NDWI
  // B2-B4 for Landsat 7 if using NDWI
  return image.addBands(ndwi).updateMask(mask);
};

// Calculate a fancier cloud mask using the quality bits provided with the Landsat data
// https://www.usgs.gov/landsat-missions/landsat-collection-1-level-1-quality-assessment-band
// https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC08_C01_T1_TOA
var maskClouds = function(image){
  var cloudShadowBitMask = (1<<4);
  var cloudsBitMask = (1<<3);  
  var cirrusBitMask = (1<<6);   
  var qa = image.select('BQA');
  var mask = qa.bitwiseAnd(cloudsBitMask).eq(0).and(qa.bitwiseAnd(cloudShadowBitMask).eq(0)).and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask);
};

// Filter the data of interest
var filtered_data = data.filterBounds(table)
                    .filter(ee.Filter.calendarRange(2000,2012,'year')) //2013-2016 for L8, 2000-2012 for L7
                    .filter(ee.Filter.calendarRange(6,8,'month')) // Only select images from melt season (June-August)
                    .map(maskClouds); // Mask remaining clouds
var collection = filtered_data.map(addNDWI);

// Reduce results over each spatial area of each catchment defined in the shapefil
var triplets = collection.map(function(image) {
  return image.select('NDWI').reduceRegions({
    collection: table, 
    reducer: ee.Reducer.max().setOutputs(['NDWI']),  // For each image, take max NDWI within each catchment
    scale: 30, // retain 30m pixel resolution in Landsat
  })
    .map(function(feature) {
    var ndwi = ee.List([feature.get('NDWI'), -9999]) // If there was no ndwi value found, we set the ndwi to a NoData value -9999
      .reduce(ee.Reducer.firstNonNull())
	// Return a table of data that includes NDWI catchment, image date, image code, and all fields from each catchment
    return feature.set({'NDWI': ndwi, 'Year': ee.Date(image.get('system:time_start')).format('YYYY'),
                        'Day': ee.Date(image.get('system:time_start')).format('DDD')})
    })
  }).flatten();

// Export results to a csv file and save it to your Google Drive
Export.table.toDrive({
    collection: triplets,
    description: 'NDWI_time_series_L7',
    fileNamePrefix: 'ndwi_time_series_L7_nocloudfilt',
    fileFormat: 'CSV'
})