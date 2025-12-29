import { useState, useRef, useEffect } from 'react'
import './thermal_printer.css'
import ReceiptPrinterEncoder from './receipt-printer-encoder.esm.js';
import WebUSBReceiptPrinter from './webusb-receipt-printer.esm.js';

import p5 from 'p5';

function App() {

  //3D printer model
  const printerSTLRef = useRef();
  //WebUSB instance
  const receiptPrinterRef = useRef();
  const [printerInfo,setPrinterInfo] = useState(null);
  //Receipt encoder instance
  const encoderRef = useRef();

  //Image selected by user
  const [currentlyRenderedImage,setCurrentlyRenderedImage] = useState(null);
  const [currentImageDataURL,setCurrentImageDataURL] = useState(null);
  const currentlyRenderedImageRef = useRef(currentlyRenderedImage);
  useEffect(() => {
    currentlyRenderedImageRef.current = currentlyRenderedImage;
  },[currentlyRenderedImage]);

  //p5 instance
  const p5Ref = useRef();

  const customCommandText = useRef('');

  const [connectedToPrinter, setConnectedToPrinter] = useState(false);
  const connectedToPrinterRef = useRef(connectedToPrinter);
  useEffect(() => {
    connectedToPrinterRef.current = connectedToPrinter;
  }, [connectedToPrinter]);

  // const [currentText,setCurrentText] = useState('hello printer');
  const [currentText,setCurrentText] = useState('');
  const currentTextRef = useRef(currentText);
  useEffect(() => {
    currentTextRef.current = currentText;
  }, [currentText]);

  const [imageRenderSettings, setImageRenderSettings] = useState({
    algorithm: 'atkinson',
    threshold: 0.5,
    scale : 1.0, // size of the image
    scaleToFillReceipt:false
  });
  const imageRenderSettingsRef = useRef(imageRenderSettings);
  //whenever the dither settings update, reprocess the image
  useEffect(() => {
    imageRenderSettingsRef.current = imageRenderSettings;
  }, [imageRenderSettings]);

  const [textFormatSettings,setTextFormatSettings] = useState({
    align : 'flex-start',//flex-start, center, flex-end
    underline : false,
    bold: false,
    italic: false,
    font : 'A',
    invert : false,
    width : 1.0, //1 --> 8
    height : 1.0, //1 --> 8
    codepage:'cp863',
    rotate90 : false,
    upsideDown : false
  });

  const textFormatSettingsRef = useRef(textFormatSettings);
  useEffect(() => {
    textFormatSettingsRef.current = textFormatSettings;
  }, [textFormatSettings]);

  const [mostRecentlyEdited,setMostRecentlyEdited] = useState('text');

  const ReceiptImage = function(image,imageSettings,textSettings){
    return ({
      type:'image',
      image:image,//p5 image
      originalImageURL:image.canvas.toDataURL(),
      imageData:convertImageToDataURLs(image,imageSettings),//converted image
      imageRenderSettings:{...imageSettings},
      textFormatSettings:{...textSettings}
    });
  }
  const ReceiptText = function(string,textSettings){
    return({
      type:'text',
      text:string,
      textFormatSettings:{...textSettings}
    });
  }

  const ReceiptCanvas = function(){
    return({
      items:[],//holds canvas elements/text nodes
    });
  }
  const [receiptCanvases,setReceiptCanvases] = useState([ReceiptCanvas()]);
  const receiptCanvasesRef = useRef(receiptCanvases);
  useEffect(() => {
    receiptCanvasesRef.current = receiptCanvases;
  }, [receiptCanvases]);
  const [currentCanvas,setCurrentCanvas] = useState(0);
  const currentCanvasRef = useRef(currentCanvas);
  useEffect(() => {
    currentCanvasRef.current = currentCanvas;
  }, [currentCanvas]);

  //-1 for a new item
  const [itemCurrentlyEditing,setItemCurrentlyEditing] = useState(-1);
  const itemCurrentlyEditingRef = useRef(itemCurrentlyEditing);
 useEffect(() => {
    itemCurrentlyEditingRef.current = itemCurrentlyEditing;
  }, [itemCurrentlyEditing]);
  //initialize
  useEffect(() => {
    receiptPrinterRef.current = new WebUSBReceiptPrinter();
    receiptPrinterRef.current.addEventListener('connected', connect);
    encoderRef.current = new ReceiptPrinterEncoder();

    const dropZone = document.getElementById("drop-zone");
    window.addEventListener("drop", (e) => {
      if ([...e.dataTransfer.items].some((item) => item.kind === "file")) {
        e.preventDefault();
      }
    });
    dropZone.addEventListener("dragover", (e) => {
      const fileItems = [...e.dataTransfer.items].filter(
        (item) => item.kind === "file",
      );
      if (fileItems.length > 0) {
        e.preventDefault();
        if (fileItems.some((item) => item.type.startsWith("image/"))) {
          e.dataTransfer.dropEffect = "copy";
        } else {
          e.dataTransfer.dropEffect = "none";
        }
      }
    });
    window.addEventListener("dragover", (e) => {
      const fileItems = [...e.dataTransfer.items].filter(
        (item) => item.kind === "file",
      );
      if (fileItems.length > 0) {
        e.preventDefault();
        if (!dropZone.contains(e.target)) {
          e.dataTransfer.dropEffect = "none";
        }
      }
    });
    dropZone.addEventListener("drop", dropHandler);
    const sketch = new p5(mainSketch);
    return () => sketch.remove();
  }, []);

  //P5 sketch body
  const mainSketch = (p) => {
    p5Ref.current = p;
    p.setup = async () => {
      printerSTLRef.current = await p.loadModel("thermal_printer.stl");
      fetch("printer.jpeg").then(
        response => {
          response.blob().then(
            blob => {
              console.log()
              const blobURL = URL.createObjectURL(blob);
              p.loadImage(blobURL, (img) => {
                const newCanv = ReceiptCanvas();
                newCanv.items = [
                  ReceiptText('*\\---------------------------------------/*',{...textFormatSettings,align:'center'}),
                  ReceiptText('~** THERMAL PRINTER FIGHTER **~',{...textFormatSettings,align:'center',invert:true}),
                  ReceiptText('*/---------------------------------------\\*',{...textFormatSettings,align:'center'}),
                  ReceiptImage(img,{...imageRenderSettings,scale:0.5,threshold:2.0},{...textFormatSettings,align:'center'}),
                  ReceiptText('to help you draw text & images using\nan esc-pos thermal printer',{...textFormatSettings,align:'center'}),
                ]
                setReceiptCanvases([newCanv]);
              })
              // uploadImage(new File([blob], 'printer.jpeg', { type: blob.type }));
            });
        });
      p.createCanvas(350, 240, p.WEBGL);
      // p.createCanvas(350, 540, p.WEBGL);
      p.angleMode(p.DEGREES);
      p.ortho();
      // p.pixelDensity(1);
      p.frameRate(8);
    }

    p.draw = () => {
      p.pixelDensity((1.0 + Math.sin(p.frameCount/20))/2.0);
      p.translate(0, 80, 0);
      p.rotateX(80);
      // p.rotateZ(140);
      p.rotateZ(p.frameCount * 10);
      p.background(0, 0, 0, 0);
      p.scale(3);
      p.normalMaterial();
      p.model(printerSTLRef.current);
    }

    return () => {
      p.remove();
    }
  }
  //connect + init printer
  function connect(device) {
    console.log(`Connected to ${device.manufacturerName} ${device.productName} (#${device.serialNumber})`);
    //create a new encoder using that language+codepage
    encoderRef.current = new ReceiptPrinterEncoder({
      language: 'esc-pos',
      columns: 48,
      imageMode: 'raster',
      // codepageMapping: 255
      codepageMapping: 'epson'
      // language:  printerLanguage,
      // codepageMapping: printerCodepageMapping
    });

    setPrinterInfo(device);
    //type == usb
    //vendorID
    //productID
    //manufacturerName
    //serialNumber
    //language
    //codepageMapping

    encoderRef.current.initialize();
    setConnectedToPrinter(true);
  }

  function sendCustomCommand(){
    const commands = customCommandText.current.split(',');
    const commandBytes = [];
    for(let cmd of commands){
      commandBytes.push(parseInt(cmd, 16));
    }
    encoderRef.current.raw(commandBytes);
    receiptPrinterRef.current.print(encoderRef.current.encode());
  }

  function advancePaper() {
    let data = encoderRef.current
      .newline()
      .encode();
    receiptPrinterRef.current.print(data);
  }
  function cutPaper() {
    let data = encoderRef.current
      .cut('full')
      .encode();
    receiptPrinterRef.current.print(data);
  }

  // max width is 576
  function dropHandler(ev) {
    const files = [...ev.dataTransfer.items]
      .map((item) => item.getAsFile())
      .filter((file) => file);
    uploadImage(files[0]);
  }

  function uploadImage(file){
    const blobURL = URL.createObjectURL(file);
    p5Ref.current.loadImage(blobURL, (img) => {
      setCurrentlyRenderedImage(img);
      setCurrentImageDataURL(img.canvas.toDataURL());
      setMostRecentlyEdited('image');
    });
  }

  function printReceipt() {
    //if not connected, prompt user to connect
    if (!connectedToPrinterRef.current)
      receiptPrinterRef.current.connect();

    // const previewItems = document.getElementById("preview").children;

    const receiptContent = receiptCanvasesRef.current[currentCanvasRef.current].items;
    for(const item of receiptContent){
      //format text
      encoderRef.current.font(item.textFormatSettings.font);
      encoderRef.current.align(getTextAlignment(item.textFormatSettings.align));
      encoderRef.current.invert(item.textFormatSettings.invert);
      encoderRef.current.size(item.textFormatSettings.width,item.textFormatSettings.height);
      encoderRef.current.underline(item.textFormatSettings.underline);
      encoderRef.current.bold(item.textFormatSettings.bold);
      encoderRef.current.codepage(item.textFormatSettings.codepage);
      encoderRef.current.italic(item.textFormatSettings.italic);

      //custom esc-pos methods!
      encoderRef.current.raw([27,123,item.textFormatSettings.upsideDown?1:0]);
      encoderRef.current.raw([0x1B,0x56,item.textFormatSettings.rotate90?1:0]);

      //if it's an image
      if (item.type === 'image') {
        for(const img of item.imageData){
          //images are pre-dithered, so threshold is used here
          encoderRef.current.image(img.canvas, img.width, img.height, 'threshold', 254);
        }
      }
      //this is a *little* broken with ascii art right now
      else if (item.type === 'text') {
        encoderRef.current.text(item.text);
        // const lines = item.text.split('\n');
        // for(const line of lines){
        //   encoderRef.current.text('|'+line);
        // }
        // console.log(lines);
        // for(const line of lines){
        //   encoderRef.current.text((line).slice(0,encoderRef.current.columns));
        // }
      }
      else if(item.type === 'cut'){
        encoderRef.current.cut('full');
      }
      else if(item.type === 'newline'){
        encoderRef.current.newline();
      }
      //print!
      receiptPrinterRef.current.print(encoderRef.current.encode());
    }
  }


  //threshold, bayer, floyd-steinberg, and atkinson
  //taken from https://beyondloom.com/blog/dither.html
  function atkinson(pixels, w, threshold) {
    const e = Array(2 * w).fill(0), m = [0, 1, w - 2, w - 1, w, 2 * w - 1]
    return pixels.map(x => {
      const pix = x + (e.push(0), e.shift()), col = pix > threshold, err = (pix - col) / 8
      m.forEach(x => e[x] += err)
      return col ? 255 : 0;
    })
  }
  function floyd(pixels, w, threshold) {
    const e = Array(w + 1).fill(0), m = [[0, 7], [w - 2, 3], [w - 1, 5], [w, 1]]
    return pixels.map(x => {
      const pix = x + (e.push(0), e.shift()), col = pix > threshold, err = (pix - col) / 16
      m.forEach(([x, y]) => e[x] += err * y)
      return col ? 255 : 0;
    })
  }
  //from chatGPT :( i caved, i didn't wanna write a convolver
  function generateBayerMatrix(k) {
    // Base case for 1×1 matrix
    if (k === 0) {
      return [[0]];
    }
    // Recursively build the matrix of size 2^(k-1)
    const M = generateBayerMatrix(k - 1);
    const n = 1 << k;        // 2^k
    const half = n >> 1;     // 2^(k-1)
    const out = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const v = M[y][x];
        out[y][x] = 4 * v;       // top-left
        out[y][x + half] = 4 * v + 2;   // top-right
        out[y + half][x] = 4 * v + 3;   // bottom-left
        out[y + half][x + half] = 4 * v + 1; // bottom-right
      }
    }
    return out;
  }
  function bayer(pixels, width, threshold) {
    const matrixLevel = 4;
    const M = generateBayerMatrix(matrixLevel);
    const size = 1 << matrixLevel;
    const maxVal = size * size - 1;
    const out = new Uint8Array(pixels.length);
    for (let y = 0; y < pixels.length / width; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const v = pixels[i] - threshold; // grayscale 0–1
        const t = M[y % size][x % size] / maxVal;
        out[i] = v < t ? 0 : 255;
      }
    }
    return out;
  }
  function threshold(pixels, w, thresh) {
    const out = [];
    for (let px of pixels) {
      out.push(px > thresh ? 255 : 0);
    }
    return out;
  }
  
  function convertImageToDataURLs(srcImg,renderSettings) {

    //create a copy of this image, to mess with
    let img = srcImg.get();

    //resample image if it's greater than 576
    const maxWidth = 576;
    img.resize(renderSettings.scaleToFillReceipt?maxWidth:renderSettings.scale*maxWidth,0);

    //if height isn't a multiple of 8, make a new image that is
    if (img.height % 8) {
      let newImg = p5Ref.current.createImage(img.width, img.height + (8 - img.height % 8));
      newImg.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
      img = newImg.get();
    }
    //if width isn't a multiple of 8, make a new image that is
    if (img.width % 8) {
      let newImg = p5Ref.current.createImage(img.width + (8 - img.width % 8), img.height);
      newImg.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
      img = newImg.get();
    }

    //dither image in place
    ditherImage(img,renderSettings);

    const maxHeight = 1720;
    //if the image is taller than 1728px, you need to break it into chunks (not sure why, limitation of ESC-POS?)
    if (img.height > maxHeight) {
      const subImages = [];
      for (let subset = 0; subset < img.height; subset += maxHeight) {
        subImages.push(img.get(0, subset, img.width, Math.min(maxHeight, img.height - subset)));
      }
      const finalImages = [];
      for (let subImg of subImages) {
        finalImages.push({url:subImg.canvas.toDataURL(),canvas:subImg.canvas,width:subImg.width,height:subImg.height});
      }
      return finalImages;
    }
    else {
      return [{url:img.canvas.toDataURL(),canvas:img.canvas,width:img.width,height:img.height}];
    }
  }
  //dithers an image in place (just modifies the pixels[] buffer)
  function ditherImage(img,renderSettings) {
    img.loadPixels();
    const pixels = [];
    // convert color to BW
    for (let byte = 0; byte < img.pixels.length; byte += 4) {
      const val = (255.0 - img.pixels[byte + 3]) + (img.pixels[byte + 3] / 255.0) * ((img.pixels[byte] + img.pixels[byte + 1] + img.pixels[byte + 2]) / 3.0);
      pixels.push(val / 255.0);
    }
    const ditherAlgorithms = {
      threshold : threshold,
      bayer : bayer,
      atkinson : atkinson,
      floyd : floyd
    };
    const ditherAlgorithm = ditherAlgorithms[renderSettings.algorithm];
    //load dithered pixels back into the image
    const newPixels = ditherAlgorithm(pixels, img.width, 1.0 - renderSettings.threshold);
    for (let p = 0; p < img.pixels.length; p += 4) {
      img.pixels[p] = newPixels[p / 4];
      img.pixels[p + 1] = newPixels[p / 4];
      img.pixels[p + 2] = newPixels[p / 4];
      img.pixels[p + 3] = newPixels[p / 4]?0:255;
    }
    img.updatePixels();
  }

  //clears the canvas
  function clear(){
    const receipt = receiptCanvasesRef.current[currentCanvasRef.current];
    receipt.items = [];
    setReceiptCanvases([...receiptCanvasesRef.current]);
    setItemCurrentlyEditing(-1);
  }

  function saveCanvasToJSON(){
    const receipt = receiptCanvasesRef.current[currentCanvasRef.current];
    const list = [];
    receipt.items.map((item,index)=>{
      if(item.type == 'image'){
        //skip p5 image objects
        list.push({...item,image:null});
      }
      else{
        list.push({...item});
      }
    })
    const jsonString = JSON.stringify(list, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "receipt.json";
    a.click();

    URL.revokeObjectURL(url);

    a.remove();
  }

  function loadCanvasFromJSON(file){
    const reader = new FileReader();
    reader.onload = async (e) => {

      //parse in the file text
      const loadedItems = JSON.parse(reader.result);

      //create a new object for each entry
      const newItemsArray = [];
      for(let item of loadedItems){
        if(item.type == 'image'){
          await p5Ref.current.loadImage(item.originalImageURL?item.originalImageURL:item.imageData[0].url,(img)=>{
            newItemsArray.push(ReceiptImage(img,item.imageRenderSettings,item.textFormatSettings));
          });
        
        }
        else{
          newItemsArray.push({
            ...item,
          })
        }
      }

      setReceiptCanvases([{items:[...newItemsArray]}]);
      setCurrentCanvas(0);
      setItemCurrentlyEditing(-1);
    }
    reader.readAsText(file);
  }

  function removePreviewItem(index){
    const receipt = receiptCanvasesRef.current[currentCanvasRef.current];
    if(itemCurrentlyEditingRef.current == index){
      const type = receipt.items[itemCurrentlyEditingRef.current].type;
      if(type == 'text')
        setCurrentText('');
      else if(type == 'image'){
        setCurrentlyRenderedImage(null);
        setCurrentImageDataURL(null);
      }
      setItemCurrentlyEditing(-1);
    }
    else if(itemCurrentlyEditingRef.current > index){
      setItemCurrentlyEditing(itemCurrentlyEditingRef.current-1);
    }
    receipt.items = receipt.items.filter((item,i) => {return (i !== index)});
    setReceiptCanvases([...receiptCanvasesRef.current]);
  }

  function swapPreviewItems(target,newPos){
    const receipt = receiptCanvasesRef.current[currentCanvasRef.current];
    //if it's outside bounds, return original position
    if(target >= receipt.items.length || newPos >= receipt.items.length || target < 0 || newPos < 0)
      return target;
    [receipt.items[target],receipt.items[newPos]] = [receipt.items[newPos],receipt.items[target]];
    setReceiptCanvases([...receiptCanvasesRef.current]);
    if(itemCurrentlyEditingRef.current == target)
      setItemCurrentlyEditing(newPos);
    else if(itemCurrentlyEditingRef.current == newPos)
      setItemCurrentlyEditing(target);
    return newPos;
  }

  function getTextStyle(formatSettings){
    const transformOriginStyle = getTransformationAlignment(formatSettings);
    return {
      textAlign:formatSettings.align,
      transform: `scale(${formatSettings.width},${formatSettings.height})`,
      transformOrigin:transformOriginStyle,
      color:formatSettings.invert?'white':'black',
      backgroundColor:formatSettings.invert?'black':null,
      width:'fit-content',
      marginBottom:`${formatSettings.height-1}em`,
      fontStyle : formatSettings.italic?'italic':'normal',
      fontWeight : formatSettings.bold?'bold':'normal',
      fontSize : formatSettings.font == 'A'?'34px':'24px',
      textDecoration:formatSettings.underline?'underline':null,
      fontFamily:formatSettings.rotate90?'receipt_90':'receipt',
      // textOrientation: 'sideways'
    };
  }

  const CurrentText = function(){
    const textStyle = getTextStyle(textFormatSettings);
    // textStyle.color = '#686868ff';
    return(
        <div key = {`preview_text_current`} className = "receipt_text current_preview" style = {textStyle}>
          {currentText}
        </div>);
  }

  const CurrentImage = function(){
    const previewImageStyle = {
      position:'relative',
    };
    const imageData = convertImageToDataURLs(currentlyRenderedImage,imageRenderSettings);
    return(<div className = 'image_holder' style = {{display:'flex',width:'fit-content',height:'fit-content',flexDirection:'column'}}>
      {imageData.map((img,index) => {
      return <img className = "current_preview" style = {{...previewImageStyle,width:img.width,height:img.height}} key = {`preview_image_current_${index}`} src = {img.url}></img>
      })}
    </div>);
  }

  function getTransformationAlignment(formatSettings){
    switch(formatSettings.align){
      case'flex-start':
        return 'top left';
      case 'flex-end':
        return'top right';
      case 'center':
      default:
        return '50% 0%';
    }
  }

  function getTextAlignment(formatSettings){
    switch(formatSettings.align){
      case'flex-start':
        return 'left';
      case 'flex-end':
        return'right';
      case 'center':
      default:
        return 'center';
    }
  }

  function loadItemForEditing(index){
    if(index == -1)
      return;
    const item = receiptCanvasesRef.current[currentCanvasRef.current].items[index];
    if(item.type == 'text'){
      setMostRecentlyEdited('text');
      setCurrentText(item.text);
      setTextFormatSettings({...item.textFormatSettings});
    }
    else if(item.type == 'image'){
      setMostRecentlyEdited('image');
      setCurrentImageDataURL(item.image.canvas.toDataURL());
      setCurrentlyRenderedImage(item.image);
      setTextFormatSettings({...item.textFormatSettings});
      setImageRenderSettings({...item.imageRenderSettings});
    }
  }

  function commitEdit(){
    if(itemCurrentlyEditingRef.current == -1)
      return;
    const item = receiptCanvasesRef.current[currentCanvasRef.current].items[itemCurrentlyEditingRef.current];
    if(item.type == 'text'){
      item.text = (currentTextRef.current === '')?'\n':currentTextRef.current;
      item.textFormatSettings = {...textFormatSettingsRef.current};
      setCurrentText('');
    }
    else{
      receiptCanvasesRef.current[currentCanvasRef.current].items[itemCurrentlyEditingRef.current] = ReceiptImage(currentlyRenderedImageRef.current,imageRenderSettingsRef.current,textFormatSettingsRef.current);
      setCurrentlyRenderedImage(null);
      setCurrentImageDataURL(null);
    }
    setReceiptCanvases([...receiptCanvasesRef.current]);
  }

  function getInputControlStyle(type){
    if(type == 'text'){
      const isActive = (itemCurrentlyEditing == -1)||(receiptCanvases[currentCanvas].items[itemCurrentlyEditing].type == type);
      return{height:'fit-content',pointerEvents:isActive?null:'none',borderColor:isActive?null:'#8d8d8dff',color:isActive?null:'#8d8d8dff'}
    }
    else if(type == 'image'){
      const isActive = (itemCurrentlyEditing == -1)||(receiptCanvases[currentCanvas].items[itemCurrentlyEditing].type == type);
    }
  }

  return (
    <div id = "gui_container">
    <div id="gui">
      <div id="title">esc-pos thermal printer fighter</div>
        {printerInfo &&
          <div style ={{mixBlendMode:'normal',gridArea:'info',color:'black',fontFamily:'receipt',fontSize:'16px'}}id = "printer_info">
            <p>{'*---------- Printer Info ----------*'}</p>
            <p>{`language: ${printerInfo.language}`}</p>
            <p>{`connection: ${printerInfo.type}`}</p>
            <p>{`manufacturer: ${printerInfo.manufacturerName}`}</p>
            <p>{`code page: ${printerInfo.codepageMapping}`}</p>
            <p>{`serial number: ${printerInfo.serialNumber}`}</p>
          </div>
        }
        <main id="p5canvas"></main>
        <div id="button_holder" className="button">
          <input id="connect_button" className = "control_button" type="button" style = {{backgroundColor:connectedToPrinter?"#4dff00ff":"#004e11ff",color:connectedToPrinter?"#000000ff":"#ffffffff",width:'100%'}} onClick={() => receiptPrinterRef.current.connect()} value={connectedToPrinter?"connected!":"connect to printer"} />
          <div style = {{display:'flex'}}>
            <input id="connect_button" className = "control_button" type="button" style = {{backgroundColor:'red',color:'white'}} onClick={clear} value={"Xx Clear xX"} />
            <input id = "save-JSON-button" type="button" style = {{borderStyle:'dashed'}} onClick={saveCanvasToJSON} value={"save JSON"} />
            <label id = "load-JSON-button" style = {{borderStyle:'dashed'}}>
              load JSON
              <input type="file" accept="application/json" style = {{display:'none'}} onInput={(e) => loadCanvasFromJSON(e.target.files[0])}/>
            </label>
          </div>
          {connectedToPrinter &&
          <p className = "control_header">{"*------------------------ printer control ------------------------*"}</p>
          }
          {!connectedToPrinter &&
          <p className = "control_header">*---------------- printer control <span style = {{color:'red'}}>{'[printer not connected]'}</span> ----------------*</p>
          }
          <div style = {{display:'flex'}}>
            <input style = {{color:connectedToPrinter?null:'#8d8d8dff',borderColor:connectedToPrinter?null:'#8d8d8dff',pointerEvents:connectedToPrinter?null:'none'}} className = "control_button" type="button" onClick={() => advancePaper()} value="advance paper" />
            <input style = {{color:connectedToPrinter?null:'#8d8d8dff',borderColor:connectedToPrinter?null:'#8d8d8dff',pointerEvents:connectedToPrinter?null:'none'}} className = "control_button" type="button" onClick={() => cutPaper()} value="✂ cut ✂" />
            <input style = {{color:connectedToPrinter?null:'#8d8d8dff',borderColor:connectedToPrinter?null:'#8d8d8dff',pointerEvents:connectedToPrinter?null:'none'}} className = "control_button" id="print_button" type="button" onClick={() => printReceipt()} value="⌘Print" />
            {currentlyRenderedImage &&
            <input className = "control_button" style = {{borderRadius:'10px'}}type="button" onClick={() => {
              const link = document.createElement('a');
              link.href = currentlyRenderedImageRef.current.canvas.toDataURL('image/png');
              link.download = 'ditheredImage.png';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }} value="⌘S" />
            }
          </div>
          <p className = "control_header">{"*---------------------------- position ----------------------------*"}</p>
          <div style = {{display:'flex',alignItems:'center'}}>
            <p>{"align: "}</p>
            <div id = "align_buttons" style = {{display:'flex'}}>
              <input className = "control_button" style = {{borderRadius:'20px',fontWeight:'bolder',backgroundColor:textFormatSettings.align == 'flex-start'?'rgba(0, 162, 255, 1)':null}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,align:'flex-start'})}} value="left" />
              <input className = "control_button" style = {{borderRadius:'20px',fontWeight:'bolder',backgroundColor:textFormatSettings.align == 'center'?'rgba(0, 162, 255, 1)':null}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,align:'center'})}} value="center" />
              <input className = "control_button" style = {{borderRadius:'20px',fontWeight:'bolder',backgroundColor:textFormatSettings.align == 'flex-end'?'rgba(0, 162, 255, 1)':null}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,align:'flex-end'})}} value="right" />
            </div>
            <input className = "control_button" style = {{borderRadius:'20px',fontWeight:'bolder',backgroundColor:textFormatSettings.upsideDown?'rgba(0, 162, 255, 1)':null}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,upsideDown:!textFormatSettingsRef.current.upsideDown})}} value="upside down" />
            <input className = "control_button" style = {{borderRadius:'20px',fontWeight:'bolder',backgroundColor:textFormatSettings.rotate90?'rgba(0, 162, 255, 1)':null}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,rotate90:!textFormatSettingsRef.current.rotate90})}} value="rotate 90" />
          </div>
          <p style = {{animation:mostRecentlyEdited=='text'?'blink_background 0.8s infinite':null}} className = "control_header">{"*------------------------------ text ------------------------------*"}</p>
          {/* preview text */}
          <div style = {{width:'100%',display:'flex',justifyContent:'center'}}>
          <textarea style ={getInputControlStyle('text')}  onClick = {()=>setMostRecentlyEdited('text')} onKeyDown={(e) => {
            if(e.key === 'Enter' && !e.shiftKey){
              //make sure this doesn't add a newline to the textbox, too
              e.stopPropagation();
              e.preventDefault();
              if(itemCurrentlyEditingRef.current == -1){
                if(e.target.value === ''){
                  receiptCanvasesRef.current[currentCanvasRef.current].items.push({type:'newline',textFormatSettings:textFormatSettingsRef.current});
                }
                else{
                  receiptCanvasesRef.current[currentCanvasRef.current].items.push(ReceiptText(e.target.value,textFormatSettingsRef.current));
                }
                //load into receipt
                setReceiptCanvases([...receiptCanvasesRef.current]);
                //clear preview text
                setCurrentText('');
              }
              else{
                commitEdit();
                setItemCurrentlyEditing(-1);
              }
            }
          }} 
          onInput = {(e) => {
            setCurrentText(e.target.value);
            setMostRecentlyEdited('text');
          }}
          value = {currentText}></textarea>
          {/* save text to preview */}
          <input style = {{backgroundColor:currentText?'blue':null,color:currentText?'white':'#8d8d8dff',borderColor:currentText?null:'#8d8d8dff'}} className = "control_button" type="button" onClick={() => {
            if(itemCurrentlyEditingRef.current == -1){
              receiptCanvasesRef.current[currentCanvasRef.current].items.push(ReceiptText(currentTextRef.current,textFormatSettingsRef.current));
              setReceiptCanvases([...receiptCanvasesRef.current]);
              setCurrentText('');
            }
            else{
              commitEdit();
              setItemCurrentlyEditing(-1);
            }
          }} value={(itemCurrentlyEditing != -1 && receiptCanvases[currentCanvas].items[itemCurrentlyEditing].type == 'text')?"finish editing [ENTER}":"add [ENTER]"} />
          </div>
          <div style = {{display:'flex', alignItems:'center'}}>
            {/* stacking the w,h sliders vertically */}
            <div style = {{display:'flex',flexDirection:'column',marginBottom:'0px',paddingBottom:'0px'}}>
              <div style = {{display:'flex',alignItems:'center',position:'relative',width:'fit-content'}}>
                <p>{"x: "}</p>
                <input style = {{width:'50px'}} type="range" className = "control_slider" id="horizontal_stretch_slider" name="horizontal_stretch" min="1.0" max="8.0" defaultValue = '1.0' step="1.0" 
                onInput={(e) => {
                  setMostRecentlyEdited('text');
                  setTextFormatSettings({...textFormatSettingsRef.current,width:parseFloat(e.target.value)})}} />
                <p style = {{position:'absolute',top:'-1em',left:'25px'}}>{'x'+textFormatSettings.width}</p>
              </div>
              <div style = {{display:'flex',alignItems:'center',position:'relative',width:'fit-content'}}>
                <p>{"y: "}</p>
                <input style = {{width:'50px'}} type="range" className = "control_slider" id="vertical_stretch_slider" name="vertical_stretch" min="1.0" max="8.0" defaultValue = '1.0' step="1.0" 
                onInput={(e) => {
                  setMostRecentlyEdited('text');
                  setTextFormatSettings({...textFormatSettingsRef.current,height:parseFloat(e.target.value)})}} />
                <p style = {{position:'absolute',top:'-1em',left:'25px'}}>{'x'+textFormatSettings.height}</p>
              </div>
            </div>
            {/* stacking the font,codepage sliders vertically */}
            <div style = {{display:'flex',flexDirection:'column',marginBottom:'0px',paddingBottom:'0px'}}>
              <div style = {{display:'flex',alignItems:'center'}}>
                <p>{"font: "}</p>
                <select name="font" className = "control_dropdown" onInput={(e) => setTextFormatSettings({...textFormatSettingsRef.current,font : e.target.value})}>
                  <option className = "control_dropdown" value="A">12x24</option>
                  <option className = "control_dropdown" value="B">9x17</option>
                </select>
              </div>
              <div style = {{display:'flex',alignItems:'center'}}>
                <p>{"codepage: "}</p>
                <select name="codepage" className = "control_dropdown" onInput={(e) => setTextFormatSettings({...textFormatSettingsRef.current,codepage : e.target.value})}>
                  <option className = "control_dropdown" value="A">12x24</option>
                  <option className = "control_dropdown" value="B">9x17</option>
                </select>
              </div>
            </div>
            <input className = "control_button" style = {{borderRadius:'20px',fontWeight:'bolder',backgroundColor:textFormatSettings.bold?'rgba(0, 162, 255, 1)':null}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,bold:!textFormatSettingsRef.current.bold})}} value="bold" />
            <input className = "control_button" style = {{borderRadius:'20px',fontStyle:'italic',backgroundColor:textFormatSettings.italic?'rgba(255, 255, 0, 1)':null}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,italic:!textFormatSettingsRef.current.italic})}} value="italic" />
            <input className = "control_button" style = {{borderRadius:'20px',fontWeight:'bolder',backgroundColor:textFormatSettings.underline?'rgba(0, 162, 255, 1)':null,textDecoration:'underline'}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,underline:!textFormatSettingsRef.current.underline})}} value="underline" />
            <input className = "control_button" style = {{borderRadius:'20px',backgroundColor:textFormatSettings.invert?'black':'white',color:textFormatSettings.invert?'white':'black'}} id="print_button" type="button" onClick = {() => {setTextFormatSettings({...textFormatSettingsRef.current,invert:!textFormatSettingsRef.current.invert})}} value="invert" />
          </div>
          {((itemCurrentlyEditing == -1)||(receiptCanvases[currentCanvas].items[itemCurrentlyEditing].type == 'image')) && <>
          <p style = {{animation:mostRecentlyEdited=='image'?'blink_background 0.8s infinite':null}} className = "control_header">{"*----------------------------- image -----------------------------*"}</p>
          {currentImageDataURL &&
          <>
          {/* save image to preview */}
          <input className = "control_button" type="button" onClick={() => {
            if(itemCurrentlyEditingRef.current == -1){
              receiptCanvasesRef.current[currentCanvasRef.current].items.push(ReceiptImage(currentlyRenderedImageRef.current,imageRenderSettingsRef.current,textFormatSettingsRef.current));
              setReceiptCanvases([...receiptCanvasesRef.current]);
              setCurrentlyRenderedImage(null);
              setCurrentImageDataURL(null);
            }
            else{
              commitEdit();
              setItemCurrentlyEditing(-1);
            }
          }} value={itemCurrentlyEditing == -1?"add":"finish editing"} />
          <div style = {{display:'flex',width:'100%',margin:'20px',justifyContent:'center',height:'fit-content',}}>
            <img onClick = {()=>setMostRecentlyEdited('image')} className = "upload_image_preview" style = {{cursor:'pointer',maxWidth:'200px'}} src={currentImageDataURL}/>
          </div>
          <input className = "control_button" type="button" style = {{backgroundColor:imageRenderSettings.scaleToFillReceipt?'blue':null,color:imageRenderSettings.scaleToFillReceipt?'white':null}} onClick={() => {
              setMostRecentlyEdited('image');
              setImageRenderSettings({...imageRenderSettingsRef.current,scaleToFillReceipt : !imageRenderSettingsRef.current.scaleToFillReceipt});
          }} value="scale 2 fill"/>
          <div style = {{display:'flex',alignItems:'center'}}>
            <p>{"dither algorithm: "}</p>
            <select name="dither type" className = "control_dropdown" onInput={(e) => {setMostRecentlyEdited('image');setImageRenderSettings({...imageRenderSettingsRef.current,algorithm: e.target.value})}}>
              <option className = "control_dropdown" value="atkinson">atkinson</option>
              <option className = "control_dropdown" value="floyd">floyd</option>
              <option className = "control_dropdown" value="bayer">bayer</option>
              <option className = "control_dropdown" value="threshold">threshold</option>
            </select>
            <div style = {{position:'relative',display:'flex',cursor:imageRenderSettings.scaleToFillReceipt?'not-allowed':null,pointerEvents:imageRenderSettings.scaleToFillReceipt?'none':null,borderColor:imageRenderSettings.scaleToFillReceipt?'#8d8d8dff':null,color:imageRenderSettings.scaleToFillReceipt?'#8d8d8dff':null}}>
            <p>{"Scale: "}</p>
            <input type="range" className = "control_slider" id="image_scale_slider" name="scale" min="0.01" max="1.0" defaultValue = "1.0" step="0.01" 
            onInput={(e) => {
                setMostRecentlyEdited('image');
                setImageRenderSettings({...imageRenderSettingsRef.current,scale: parseFloat(e.target.value)});
              }} />
            <p style = {{position:'absolute',right:`-${imageRenderSettings.scale.toString().length+1}ch`}}>{imageRenderSettings.scale}</p>
          </div>
          </div>
          <div style = {{display:'flex',position:'relative'}}>
            <p>{'Brightness:'}</p>
            <input type="range" className = "control_slider" id="dither_threshold_slider" name="threshold" min="0.01" max="4.0" defaultValue = '0.5' step="0.01" 
            onInput={(e) => {
              setMostRecentlyEdited('image');
              setImageRenderSettings({...imageRenderSettingsRef.current,threshold:parseFloat(e.target.value)})}} />
            <p style = {{position:'absolute',right:`-${imageRenderSettings.threshold.toString().length+1}ch`}}>{imageRenderSettings.threshold}</p>
          </div>
          </>
          }
          <label id="drop-zone">
            Drop images here, or click to upload.
            <input type="file" id="file-input" multiple accept="image/*" onInput={(e) => uploadImage(e.target.files[0])} />
          </label>
          </>}
          <p className = "control_header">{"*----------------------------- special ----------------------------*"}</p>
          <div style ={{display:'flex'}}>
            <input className = "control_button" type="button" onClick={() => {
                //load into receipt
                receiptCanvasesRef.current[currentCanvasRef.current].items.push({type:'cut',textFormatSettings:{...textFormatSettingsRef.current}});
                setReceiptCanvases([...receiptCanvasesRef.current]);
              }} value="cut" />
              <input className = "control_button" type="button" onClick={() => {
                //load into receipt
                receiptCanvasesRef.current[currentCanvasRef.current].items.push({type:'newline',textFormatSettings:{...textFormatSettingsRef.current}});
                setReceiptCanvases([...receiptCanvasesRef.current]);
              }} value="newline" />
          </div>
        <p className = "control_header">{"*-------------------------- esc commands --------------------------*"}</p>
        <div style = {{display:'flex',alignItems:'center',flexDirection:'row'}}>
          <textarea style = {{marginLeft:'20px',padding:'none',width:'100px',height:'25px',color:'white',backgroundColor:'black',alignContent:'center'}} onInput={(e) => {customCommandText.current = e.target.value}}></textarea>
          <input className = "control_button" style = {{width:'fit-content',height:'30px'}} type="button" onClick={() => sendCustomCommand()} value="send raw command" />
        </div>
        <p className = "control_header">{"*------------------------------------------------------------------*"}</p>
        </div>
        <div id="receipt_holder">
        <div id="receipt" onClick = {()=>{if(-1 == itemCurrentlyEditingRef.current)return;setItemCurrentlyEditing(-1);if(itemCurrentlyEditingRef.current != -1)commitEdit();}}>
          {receiptCanvases[currentCanvas].items.map((item,index) => {
            const previewRowStyle = {
              width:'100%',
              position:'relative',
              height:'fit-content',
              display:'flex',
              justifyContent:index == itemCurrentlyEditing?textFormatSettings.align:item.textFormatSettings.align,
            };
            const deleteButtonStyle = {
              width:'20px',
              height:'20px',
              borderRadius:'10px',
              color:'black',
              backgroundColor:'red',
              fontSize:'20px',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              cursor:'pointer',
              fontWeight:'bold',
            }
            const buttonHolderStyle = {
              position:'absolute',
              left:'0px',
              top:'0px',
              display:'flex',
              flexDirection:'row',
              alignItems:'center',
              height:'fit-content',
              width:'fit-content',
              gap:'2px'
            }
            if(item.type == 'text'){
              const textStyle = getTextStyle(index == itemCurrentlyEditing?textFormatSettings:item.textFormatSettings);
              return (
              <div key = {`preview_row_${index}`} className = 'preview_row' style = {previewRowStyle}>
                <div style = {{width:'fit-content',position:'relative'}}>
                  <div key = {`preview_item_${index}`} className = {`receipt_text ${index == itemCurrentlyEditing?'current_preview':'preview_item'}`} style = {textStyle} onClick = {(e)=>{if(index == itemCurrentlyEditingRef.current)return;e.stopPropagation();setItemCurrentlyEditing(index);if(itemCurrentlyEditingRef.current != -1)commitEdit();loadItemForEditing(index);}}>
                    {index == itemCurrentlyEditing?currentText:item.text}
                  </div>
                </div>
                <div style = {buttonHolderStyle} className = 'preview_item_button_holder'>
                  <div key = {`preview_item_delete_button_${index}`} className = 'cancel_button' style = {deleteButtonStyle} onClick = {(e) => {e.stopPropagation();e.preventDefault();removePreviewItem(index)}}>x</div>
                  <div className = "cancel_button" style = {{cursor:'pointer',border:'1px solid',borderRadius:'6px',fontSize:'12px',backgroundColor:"white",color:"black",width:'20px',textAlign:'center'}} onClick={(e) => {e.stopPropagation();swapPreviewItems(index,index-1)}}>{'▲'}</div>
                  <div className = "cancel_button" style = {{cursor:'pointer',border:'1px solid',borderRadius:'6px',fontSize:'12px',backgroundColor:"white",color:"black",width:'20px',textAlign:'center'}} onClick={(e) => {e.stopPropagation();swapPreviewItems(index,index+1)}}>{'▼'}</div>
                </div>
              </div>);
            }
            else if(item.type == 'image'){
              const previewImageStyle = {
                position:'relative',
              };
              const imageData = (index == itemCurrentlyEditing)?convertImageToDataURLs(currentlyRenderedImage,imageRenderSettings):item.imageData;
              //if it's an array of images (for a tall image)
              return(
                <div key = {`preview_row_${index}`} className = 'preview_row' style = {previewRowStyle}>
                    <div className = {`image_holder ${index == itemCurrentlyEditing?'current_preview':'preview_item'}`} style = {{position:'relative',display:'flex',width:'fit-content',height:'fit-content',flexDirection:'column'}} onClick = {(e)=>{if(index == itemCurrentlyEditingRef.current)return;e.stopPropagation();setItemCurrentlyEditing(index);if(itemCurrentlyEditingRef.current != -1)commitEdit();loadItemForEditing(index);}}>
                      {imageData.map((im,index2) => {
                        return <img style = {{...previewImageStyle,width:im.width,height:im.height}} key = {`preview_image_${index2}`} src = {im.url}></img>
                      })}
                    </div>
                  <div style = {buttonHolderStyle} className = 'preview_item_button_holder'>
                    <div key = {`preview_item_delete_button_${index}`} className = 'cancel_button' style = {deleteButtonStyle} onClick = {(e) => {e.stopPropagation();e.preventDefault();removePreviewItem(index)}}>x</div>
                    <div className = "cancel_button" style = {{cursor:'pointer',border:'1px solid',borderRadius:'6px',fontSize:'12px',backgroundColor:"white",color:"black",width:'20px',textAlign:'center'}} onClick={(e) => {e.stopPropagation();swapPreviewItems(index,index-1)}}>{'▲'}</div>
                    <div className = "cancel_button" style = {{cursor:'pointer',border:'1px solid',borderRadius:'6px',fontSize:'12px',backgroundColor:"white",color:"black",width:'20px',textAlign:'center'}} onClick={(e) => {e.stopPropagation();swapPreviewItems(index,index+1)}}>{'▼'}</div>
                  </div>
                </div>
              );
            }
            else if(item.type == 'cut'){
              const cutPreviewStyle = {
                color:'red',
                textAlign:'center'
              }
              return (
              <div key = {`preview_row_${index}`} className = 'preview_row' style = {previewRowStyle}>
                <div style = {{width:'fit-content',position:'relative'}}>
                  <div key = {`preview_item_${index}`} className = {`receipt_text ${index == itemCurrentlyEditing?'current_preview':'preview_item'}`} style = {cutPreviewStyle} onClick = {(e)=>{if(index == itemCurrentlyEditingRef.current)return;e.stopPropagation();setItemCurrentlyEditing(index);if(itemCurrentlyEditingRef.current != -1)commitEdit();loadItemForEditing(index);}}>
                    -----------------------------------------------
                  </div>
                </div>
                <div style = {buttonHolderStyle} className = 'preview_item_button_holder'>
                  <div key = {`preview_item_delete_button_${index}`} className = 'item_button' style = {deleteButtonStyle} onClick = {(e) => {e.stopPropagation();e.preventDefault();removePreviewItem(index)}}>x</div>
                  <div className = "move_button" onClick={(e) => {e.stopPropagation();swapPreviewItems(index,index-1)}}>{'▲'}</div>
                  <div className = "move_button" onClick={(e) => {e.stopPropagation();swapPreviewItems(index,index+1)}}>{'▼'}</div>
                </div>
              </div>);
            }
            else if(item.type == 'newline'){
              const newlinePreviewStyle = {
                color:'#4dff4aff'
              }

              return (
              <div key = {`preview_row_${index}`} className = 'preview_row' style = {previewRowStyle}>
                <div style = {{width:'fit-content',position:'relative'}}>
                  <div key = {`preview_item_${index}`} className = {`receipt_text ${index == itemCurrentlyEditing?'current_preview':'preview_item'}`} style = {newlinePreviewStyle} onClick = {(e)=>{if(index == itemCurrentlyEditingRef.current)return;e.stopPropagation();setItemCurrentlyEditing(index);if(itemCurrentlyEditingRef.current != -1)commitEdit();loadItemForEditing(index);}}>
                    \n                                           \n
                  </div>
                </div>
                <div style = {buttonHolderStyle} className = 'preview_item_button_holder'>
                  <div key = {`preview_item_delete_button_${index}`} className = 'cancel_button' style = {deleteButtonStyle} onClick = {(e) => {e.stopPropagation();e.preventDefault();removePreviewItem(index)}}>x</div>
                  <div className = "cancel_button" style = {{cursor:'pointer',border:'1px solid',borderRadius:'6px',fontSize:'12px',backgroundColor:"white",color:"black",width:'20px',textAlign:'center'}} onClick={(e) => {e.stopPropagation();swapPreviewItems(index,index-1)}}>{'▲'}</div>
                  <div className = "cancel_button" style = {{cursor:'pointer',border:'1px solid',borderRadius:'6px',fontSize:'12px',backgroundColor:"white",color:"black",width:'20px',textAlign:'center'}} onClick={(e) => {e.stopPropagation();swapPreviewItems(index,index+1)}}>{'▼'}</div>
                </div>
              </div>);
            }
          })}
          {itemCurrentlyEditing == -1 &&
          <div className = 'preview_row'
            style = {{
              width:'100%',
              height:'fit-content',
              display:'flex',
              justifyContent:textFormatSettings.align,
            }}>
            {mostRecentlyEdited == 'text' && currentText &&
              <CurrentText></CurrentText>
            }
            {mostRecentlyEdited == 'image' && currentlyRenderedImage &&
              <CurrentImage></CurrentImage>
            }
          </div>
          }
        </div>
      </div>
      </div>
      </div>
  )
}

export default App
