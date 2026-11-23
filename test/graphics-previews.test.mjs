import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {locations} from '../public/core/graphics-model.js';
import {rasterInfo} from '../server/graphics-gallery.mjs';
test('bundled gameplay previews have valid localized locations and bounded real raster images',()=>{const samples=JSON.parse(fs.readFileSync('public/data/graphics-previews.json','utf8'));const seen=new Set();assert.ok(samples.length>=6);let bytes=0;for(const sample of samples){assert.ok(locations.includes(sample.location),sample.location);assert.ok(!seen.has(sample.id));seen.add(sample.id);assert.match(sample.url,/^\/assets\/graphics-previews\/[a-z-]+\.jpg$/);assert.equal(sample.kind,'game-screenshot');const data=fs.readFileSync('public'+sample.url),info=rasterInfo(data);bytes+=data.length;assert.equal(info.width,sample.width);assert.equal(info.height,sample.height);assert.ok(info.width<=1600&&info.height<=900)}assert.ok(bytes<3*1024*1024)});
