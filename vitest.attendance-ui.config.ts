import {defineConfig,mergeConfig} from 'vitest/config';
import {transform} from 'next/dist/build/swc';
import base from './vitest.config';

// Next preserves JSX in tsconfig; compile UI fixtures with the same SWC loader.
export default mergeConfig(base,defineConfig({plugins:[{
 name:'attendance-ui-jsx',enforce:'pre',
 async transform(code,id){
  if(!id.includes('node_modules')&&/\.jsx$/.test(id)){
   const result=await transform(code,{filename:id,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}},target:'es2022'},module:{type:'es6'}});
   return {code:result.code,map:null};
  }
 },
}]}));
