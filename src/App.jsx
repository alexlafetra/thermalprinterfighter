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
  //Receipt encoder instance
  const encoderRef = useRef();
  //Image selected by user
  const currentlyRenderedImage = useRef();
  //p5 instance
  const p5Ref = useRef();

  const [connectedToPrinter, setConnectedToPrinter] = useState(false);
  const connectedToPrinterRef = useRef(connectedToPrinter);
  useEffect(() => {
    connectedToPrinterRef.current = connectedToPrinter;
  }, [connectedToPrinter]);

  const [previewText,setPreviewText] = useState(undefined);
  const previewTextRef = useRef(previewText);
  useEffect(() => {
    previewTextRef.current = previewText;
  }, [previewText]);

  const [imageRenderSettings, setImageRenderSettings] = useState({
    algorithm: 'atkinson',
    threshold: 0.5,
    scale : 1.0 // size of the image
  });
  const imageRenderSettingsRef = useRef(imageRenderSettings);
  //whenever the dither settings update, reprocess the image
  useEffect(() => {
    imageRenderSettingsRef.current = imageRenderSettings;
    if (currentlyRenderedImage.current)
      processImage(currentlyRenderedImage.current);
  }, [imageRenderSettings]);

  const [textFormatSettings,setTextFormatSettings] = useState({
    align : 'left',//right, left, center
    underline : false,
    bold: false,
    italic: false,
    font : 'A',
    invert : false,
    width : 1.0, //1 --> 8
    height : 1.0, //1 --> 8
    codepage:'cp863',
  });

  const textFormatSettingsRef = useRef(textFormatSettings);
  useEffect(() => {
    textFormatSettingsRef.current = textFormatSettings;
  }, [textFormatSettings]);

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
      p.createCanvas(350, 240, p.WEBGL);
      p.angleMode(p.DEGREES);
      p.ortho();
      // p.pixelDensity(0.3);
      p.pixelDensity(1);
      p.frameRate(8);
    }

    p.draw = () => {
      p.translate(0, 80, 0);
      p.rotateX(80);
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

    encoderRef.current.initialize();
    console.log(device);
    setConnectedToPrinter(true);
  }

  function handleConnectButtonClick() {
    receiptPrinterRef.current.connect();
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
      //deep copy the image, in case we want to tweak the rendering algorithm
      currentlyRenderedImage.current = img
      processImage(currentlyRenderedImage.current);
    });
  }

  function sendPreviewDataToPrinter() {
    //if not connected, prompt user to connect
    if (!connectedToPrinterRef.current)
      receiptPrinterRef.current.connect();

    const previewItems = document.getElementById("preview").children;

    //format text
    encoderRef.current.font(textFormatSettingsRef.current.font);
    encoderRef.current.align(textFormatSettingsRef.current.align);
    encoderRef.current.invert(textFormatSettingsRef.current.invert);
    encoderRef.current.size(textFormatSettingsRef.current.width,textFormatSettingsRef.current.height);
    encoderRef.current.underline(textFormatSettingsRef.current.underline);
    encoderRef.current.bold(textFormatSettingsRef.current.bold);
    encoderRef.current.codepage(textFormatSettingsRef.current.codepage);
    encoderRef.current.italic(textFormatSettingsRef.current.italic);

    for (const item of previewItems) {
      //if it's an image
      if (item.nodeName === 'IMG') {
        encoderRef.current = encoderRef.current.image(item, item.width, item.height, 'threshold', 128);
      }
      else if (item.nodeName === 'P') {
        encoderRef.current.text(item.innerHTML);
      }
    }
    receiptPrinterRef.current.print(encoderRef.current.encode());
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
        const v = pixels[i]; // grayscale 0–1
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
  function processImage(srcImg) {
    //erases previous images from preview
    document.getElementById("preview").replaceChildren();

    //create a copy of this image, to mess with
    let img = srcImg.get();

    //resample image if it's greater than 576
    const maxWidth = 576 * imageRenderSettingsRef.current.scale;
    if (img.width > maxWidth) {
      img.resize(maxWidth, 0);
    }
    //if height isn't a multiple of 8, make a new image that is
    if (img.height % 8) {
      let newImg = p5Ref.current.createImage(img.width, img.height + (8 - img.height % 8));
      newImg.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
      img = newImg.get();
    }
    //if the image is taller than 1728px, you need to break it into chunks (not sure why, limitation of ESC-POS?)
    const maxHeight = 1720;
    if (img.height > maxHeight) {
      const subImages = [];
      for (let subset = 0; subset < img.height; subset += maxHeight) {
        subImages.push(img.get(0, subset, img.width, Math.min(maxHeight, img.height - subset)));
      }
      for (img of subImages) {
        ditherImage(img);
      }
      return;
    }
    else {
      ditherImage(img);
    }
  }
  function getDitherAlgorithm(algorithm) {
    switch (algorithm) {
      case 'threshold':
        return threshold;
      case 'bayer':
        return bayer;
      case 'atkinson':
        return atkinson;
      case 'floyd':
        return floyd;
    }
  }
  function ditherImage(img) {
    img.loadPixels();
    const pixels = [];
    // convert color to BW
    for (let byte = 0; byte < img.pixels.length; byte += 4) {
      const val = (255.0 - img.pixels[byte + 3]) + (img.pixels[byte + 3] / 255.0) * ((img.pixels[byte] + img.pixels[byte + 1] + img.pixels[byte + 2]) / 3.0);
      pixels.push(val / 255.0);
    }
    //load dithered pixels back into the image
    const ditherAlgorithm = getDitherAlgorithm(imageRenderSettingsRef.current.algorithm);
    const newPixels = ditherAlgorithm(pixels, img.width, imageRenderSettingsRef.current.threshold);
    for (let p = 0; p < img.pixels.length; p += 4) {
      img.pixels[p] = newPixels[p / 4];
      img.pixels[p + 1] = newPixels[p / 4];
      img.pixels[p + 2] = newPixels[p / 4];
      img.pixels[p + 3] = 255;
    }
    img.updatePixels();
    let newImage = document.createElement("img");
    newImage.src = img.canvas.toDataURL();
    newImage.className = "image_preview";
    newImage.style = {
      width:`${newImage.width}px`,
    };
    let previewDiv = document.getElementById("preview");
    previewDiv.appendChild(newImage);
  }

  function clearPreview() {
    const preview = document.getElementById("preview");
    for(let node of preview.children){
      if(node.nodeName === 'IMG'){
        node.remove();
      }
    }
    setPreviewText('');
  }

  const previewTextStyle = {
    textAlign:textFormatSettings.align,
    transform: `scale(${textFormatSettings.width},${textFormatSettings.height})`,
    transformOrigin: textFormatSettings.align,
    color:textFormatSettings.invert?'white':'black',
    backgroundColor:textFormatSettings.invert?'black':'transparent',
    // width:'fit-content',
    fontStyle : textFormatSettings.italic?'italic':'normal',
    fontWeight : textFormatSettings.bold?'bold':'normal',
    fontSize : textFormatSettings.font == 'A'?'34px':'24px'
  };

  return (
    <div id="gui">
      <div id="preview_holder">
        {connectedToPrinter &&
        <p style = {{margin:'auto',width:'300px'}}>*------------------ preview ------------------*</p>
        }
        <div id="preview" style = {{justifyContent:textFormatSettings.align}}>
          {previewText &&
          <p style = {previewTextStyle}>{previewText}</p>
          }
        </div>
      </div>
      <div id="title">esc-pos thermal printer fighter</div>
        <main id="p5canvas"></main>
        <div id="button_holder" className="button">
          <input id="connect_button" className = "control_button" type="button" style = {{backgroundColor:connectedToPrinter?"#a6ff80ff":"rgb(247, 247, 240)"}} onClick={() => handleConnectButtonClick()} value={connectedToPrinter?"connected!":"connect to printer"} />
          <div style = {{display:connectedToPrinter?'grid':'none'}}>
            <p className = "control_header">{"*--- esc commands ---*"}</p>
            <div style = {{display:'flex'}}>
              <input className = "control_button" type="button" onClick={() => advancePaper()} value="advance paper" />
              <input className = "control_button" type="button" onClick={() => cutPaper()} value="cut paper" />
              <input className = "control_button" style = {{borderColor:"#8086ffff"}} id="print_button" type="button" onClick={() => sendPreviewDataToPrinter()} value="send data to printer & print" />
              <input className = "control_button" style = {{borderColor:"#ff8080ff"}} type="button" onClick={() => clearPreview()} value="clear preview" />
            </div>
            <div style = {{display:'flex',alignItems:'center'}}>
              <p>{"align: "}</p>
              <select name="align type" className = "control_dropdown" onInput={(e) => setTextFormatSettings({...textFormatSettingsRef.current,align:e.target.value})}>
                <option className = "control_dropdown" value="left">left</option>
                <option className = "control_dropdown" value="center">center</option>
                <option className = "control_dropdown" value="right">right</option>
              </select>
            </div>
            <p className = "control_header">{"*--- image ---*"}</p>
            <div style = {{display:'flex',alignItems:'center'}}>
              <p>{"dither algorithm: "}</p>
              <select name="dither type" className = "control_dropdown" onInput={(e) => setImageRenderSettings({...imageRenderSettingsRef.current,algorithm: e.target.value})}>
                <option className = "control_dropdown" value="atkinson">atkinson</option>
                <option className = "control_dropdown" value="floyd">floyd</option>
                <option className = "control_dropdown" value="bayer">bayer</option>
                <option className = "control_dropdown" value="threshold">threshold</option>
              </select>
              <p>{"size: "}</p>
              <select name="dither type" className = "control_dropdown" onInput={(e) => setImageRenderSettings({...imageRenderSettingsRef.current,scale : parseFloat(e.target.value)})}>
                <option className = "control_dropdown" value="1.0">100%</option>
                <option className = "control_dropdown" value="0.75">75%</option>
                <option className = "control_dropdown" value="0.5">50%</option>
                <option className = "control_dropdown" value="0.25">25%</option>
              </select>
            </div>
            {imageRenderSettings.algorithm != 'bayer' &&
            <div style = {{display:'flex'}}>
              <p>{'Threshold:'}</p>
              <input type="range" className = "control_slider" id="dither_threshold_slider" name="threshold" min="0" max="4.0" step="0.01" onInput={(e) => setImageRenderSettings({...imageRenderSettingsRef.current,threshold: 1.0 - parseFloat(e.target.value)})} />
              <p>{Math.round((imageRenderSettings.threshold + Number.EPSILON) * 100) / 100}</p>
            </div>
            }
            <label id="drop-zone">
              Drop images here, or click to upload.
              <input type="file" id="file-input" multiple accept="image/*" onInput={(e) => uploadImage(e.target.files[0])} />
            </label>
            <p className = "control_header">{"*--- text ---*"}</p>
            <textarea rows="4" cols="48" onInput={(e) => {clearPreview();setPreviewText(e.target.value)}}></textarea>
            <div style = {{display:'flex', alignItems:'center'}}>
              {/* stacking the w,h sliders vertically */}
              <div style = {{display:'flex',flexDirection:'column',marginBottom:'0px',paddingBottom:'0px'}}>
                <div style = {{display:'flex',alignItems:'center'}}>
                  <p>{"x: "}</p>
                  <select name="horizontal stretch" className = "control_dropdown" onInput={(e) => setTextFormatSettings({...textFormatSettingsRef.current,width : parseFloat(e.target.value)})}>
                    <option className = "control_dropdown" value="1.0">1x</option>
                    <option className = "control_dropdown" value="2.0">2x</option>
                    <option className = "control_dropdown" value="3.0">3x</option>
                    <option className = "control_dropdown" value="4.0">4x</option>
                    <option className = "control_dropdown" value="5.0">5x</option>
                    <option className = "control_dropdown" value="6.0">6x</option>
                    <option className = "control_dropdown" value="7.0">7x</option>
                    <option className = "control_dropdown" value="8.0">8x</option>
                  </select>
                </div>
                <div style = {{display:'flex',alignItems:'center'}}>
                  <p>{"y: "}</p>
                  <select name="vertical stretch" className = "control_dropdown" onInput={(e) => setTextFormatSettings({...textFormatSettingsRef.current,height : parseFloat(e.target.value)})}>
                    <option className = "control_dropdown" value="1.0">1x</option>
                    <option className = "control_dropdown" value="2.0">2x</option>
                    <option className = "control_dropdown" value="3.0">3x</option>
                    <option className = "control_dropdown" value="4.0">4x</option>
                    <option className = "control_dropdown" value="5.0">5x</option>
                    <option className = "control_dropdown" value="6.0">6x</option>
                    <option className = "control_dropdown" value="7.0">7x</option>
                    <option className = "control_dropdown" value="8.0">8x</option>
                  </select>
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
              <input className = "control_button" style = {{fontWeight:'bolder',backgroundColor:textFormatSettings.bold?'rgb(255, 255, 89, 1)':'rgb(247, 247, 240)'}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,bold:!textFormatSettingsRef.current.bold})}} value="bold" />
              <input className = "control_button" style = {{fontStyle:'italic',backgroundColor:textFormatSettings.italic?'rgba(255, 255, 89, 1)':'rgb(247, 247, 240)'}} type="button" onClick={() => {setTextFormatSettings({...textFormatSettingsRef.current,italic:!textFormatSettingsRef.current.italic})}} value="italic" />
              <input className = "control_button" style = {{backgroundColor:textFormatSettings.invert?'black':'white',color:textFormatSettings.invert?'white':'black'}} id="print_button" type="button" onClick = {() => {setTextFormatSettings({...textFormatSettingsRef.current,invert:!textFormatSettingsRef.current.invert})}} value="invert" />
            </div>
          </div>
        </div>
    </div>
  )
}

export default App
