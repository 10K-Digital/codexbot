import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Hand-traced in the reference's 1254 × 1254 coordinate space. Each patch is
// the visible part of a ribbon: seams stay closed throughout the animation.
const ribbons = [
  {id:'crown', d:'M314 291C343 174 461 91 582 95C683 93 777 140 827 223C879 302 908 375 930 475C870 399 722 404 630 358C529 291 445 258 314 291Z', light:[760,212,420], axis:[650,105,400,465], seam:'M307 292C450 253 531 292 630 358'},
  {id:'west', d:'M170 706C72 623 89 457 178 367C215 329 260 303 314 291C445 258 529 291 630 358C506 402 390 462 308 526C242 578 199 640 170 706Z', light:[302,322,365], axis:[247,323,442,571], seam:'M630 357C519 395 391 461 308 526C242 578 199 640 170 706'},
  {id:'southwest', d:'M308 526C306 600 348 696 365 766C371 862 399 966 475 1055C360 1088 232 1008 180 912C136 832 147 755 170 706C199 640 242 578 308 526Z', light:[206,650,358], axis:[183,677,431,846], seam:'M308 526C306 600 348 696 365 766C371 862 399 966 475 1055'},
  {id:'south', d:'M365 766C394 858 476 842 570 868C678 883 743 972 842 990C885 1000 930 992 968 983C925 1090 821 1156 707 1159C595 1160 525 1117 475 1055C399 966 371 862 365 766Z', light:[523,879,385], axis:[567,877,639,1149], seam:'M654 894C708 926 773 981 842 990C885 1000 930 992 968 983'},
  {id:'southeast', d:'M1104 577C1172 634 1189 754 1150 840C1117 916 1030 966 968 983C923 995 883 1000 842 990C773 981 708 926 654 894C774 866 886 800 963 751C1039 703 1081 644 1104 577Z', light:[1101,668,397], axis:[1061,655,842,988], seam:'M654 894C774 866 886 800 963 751C1039 703 1081 644 1104 577'},
  {id:'east', d:'M827 223C938 195 1040 265 1087 350C1129 428 1132 507 1104 577C1081 644 1039 703 963 751C995 681 957 560 930 475C908 375 879 302 827 223Z', light:[975,291,362], axis:[1078,385,895,513], seam:'M827 223C879 302 908 375 930 475C957 560 995 681 963 751'}
];
const face='M308 526C390 462 506 402 630 358C722 404 870 399 930 475C957 560 995 681 963 751C886 800 774 866 654 894C625 882 598 874 570 868C476 842 394 858 365 766C348 696 306 600 308 526Z';
const gradient=(id,x1,y1,x2,y2,stops)=>`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`;
function svg({animated=false,sad=false,small=false}={}){
 const defs=`${ribbons.map(r=>`<path id="${r.id}" d="${r.d}"/><clipPath id="clip-${r.id}"><use href="#${r.id}"/></clipPath>${gradient('jade-'+r.id,...r.axis,[[0,'#c3efd5'],[.34,'#96d6b9'],[.7,'#79bea4'],[1,'#43957b']])}<radialGradient id="light-${r.id}" gradientUnits="userSpaceOnUse" cx="${r.light[0]}" cy="${r.light[1]}" r="${r.light[2]}"><stop stop-color="#ecffe9" stop-opacity=".55"/><stop offset=".6" stop-color="#c4f3d7" stop-opacity=".13"/><stop offset="1" stop-color="#b8edce" stop-opacity="0"/></radialGradient>`).join('\n')}
 <path id="face-shape" d="${face}"/><clipPath id="face-clip"><use href="#face-shape"/></clipPath>
 <radialGradient id="porcelain" gradientUnits="userSpaceOnUse" cx="712" cy="510" r="532"><stop stop-color="#f6fbf0"/><stop offset=".55" stop-color="#e6f2e4"/><stop offset=".82" stop-color="#cfdfcd"/><stop offset="1" stop-color="#8fb49c"/></radialGradient>
 <radialGradient id="ink" cx="65%" cy="35%" r="75%"><stop stop-color="#244a3b"/><stop offset=".7" stop-color="#103327"/><stop offset="1" stop-color="#05271d"/></radialGradient>
 <radialGradient id="tear-glass" cx="30%" cy="25%" r="75%"><stop stop-color="#e7fff8"/><stop offset=".35" stop-color="#a6dedb"/><stop offset="1" stop-color="#398d94"/></radialGradient>
 <filter id="seam" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="15"/></filter>
 <filter id="cushion" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="18" result="blur"/><feComposite in="SourceAlpha" in2="blur" operator="out" result="rim"/><feFlood flood-color="#124d36" flood-opacity=".28"/><feComposite in2="rim" operator="in"/><feComposite in2="SourceGraphic" operator="over"/></filter>
 <filter id="satin" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="3" seed="17" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".12"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="soft-light"/></filter>
 <pattern id="weave" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V3" stroke="#f3fff3" stroke-opacity=".085" stroke-width=".65"/></pattern>`;
 const css=animated?`<style>
 .mascot{transform-origin:637px 629px;animation:${sad?'sob':'breathe'} ${sad?'3.8':'5.8'}s ease-in-out infinite}
 .eye{transform-origin:797px 565px;animation:blink 6.4s infinite}
 .tear{animation:teardrop 3s cubic-bezier(.4,0,.7,1) infinite}.second{animation-delay:-1.5s}
 @keyframes breathe{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-6px) rotate(1deg)}}
 @keyframes sob{0%,100%{transform:translateY(0) rotate(0)}40%{transform:translateY(5px) rotate(-.65deg)}55%{transform:translateY(1px) rotate(-.4deg)}70%{transform:translateY(5px) rotate(-.65deg)}}
 @keyframes blink{0%,43%,47%,100%{transform:scaleY(1)}45%{transform:scaleY(.08)}}
 @keyframes teardrop{0%{transform:translateY(-8px);opacity:0}18%,45%{opacity:.92}100%{transform:translateY(102px);opacity:0}}
 @media(prefers-reduced-motion:reduce){*{animation:none!important}.tear{opacity:.8}}
 </style>`:'';
 const happy=`<path d="M443 558C472 566 526 584 551 600C574 614 575 630 555 644L465 695C445 708 429 696 428 681C425 660 441 651 459 642L499 622L435 608C407 602 405 574 425 560C430 557 436 557 443 558Z"/>
 <g class="eye" stroke="none"><path d="M769 468C812 456 840 496 856 552C872 608 859 653 831 662C791 677 762 643 746 590C728 535 725 482 769 468Z"/><ellipse cx="800" cy="509" rx="17" ry="30" transform="rotate(-29 800 509)" fill="#fffdf7"/><ellipse cx="796" cy="502" rx="11" ry="20" transform="rotate(-29 796 502)" fill="#fff" opacity=".5"/></g>
 <path d="M594 720C648 724 698 700 732 679C748 669 757 680 751 704C744 747 710 776 671 778C635 782 605 767 586 746C575 733 578 720 594 720Z"/>`;
 const crying=`<path d="M420 571Q470 531 526 570M748 538Q793 493 837 534" fill="none" stroke="#163c2d" stroke-width="27" stroke-linecap="round"/><path d="M581 755Q646 683 720 734Q734 747 718 750Q650 715 599 768Q583 782 581 755Z"/>
 <g fill="url(#tear-glass)" stroke="#5fa9a5" stroke-width="1"><path class="tear" d="M445 604C443 627 420 652 424 669C430 694 466 690 469 669C471 650 454 629 445 604Z"/><path class="tear second" d="M797 574C795 597 772 622 776 639C782 664 818 660 821 639C823 620 806 599 797 574Z"/></g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" role="img" aria-labelledby="title"><title id="title">Codexbot${sad?' sem conexão':''}</title>
<!-- Generated by scripts/generate-mascots.mjs. Self-contained vector artwork; no embedded raster. -->
<defs>${defs}</defs>${css}
<g class="mascot">
 ${ribbons.map(r=>`<use href="#${r.id}" fill="#629e83" stroke="#629e83" stroke-width="2"/>`).join('')}
 <g ${small?'':'filter="url(#satin)"'}>
  <use href="#face-shape" fill="url(#porcelain)" filter="url(#cushion)"/>
  <g clip-path="url(#face-clip)" fill="none" stroke="#174e34" filter="url(#seam)"><path d="M309 526C390 462 506 402 630 358C722 404 870 399 930 475" stroke-width="40" opacity=".55"/><path d="M308 526C306 600 348 696 365 766C394 858 476 842 570 868C598 874 625 882 654 894C774 866 886 800 963 751" stroke-width="25" opacity=".4"/></g>
  ${ribbons.map(r=>`<g clip-path="url(#clip-${r.id})"><use href="#${r.id}" fill="url(#jade-${r.id})" filter="url(#cushion)"/><use href="#${r.id}" fill="url(#light-${r.id})"/><path d="${r.seam}" fill="none" stroke="#03402b" stroke-width="39" opacity=".65" filter="url(#seam)"/>${small?'':`<use href="#${r.id}" fill="url(#weave)"/>`}<use href="#${r.id}" fill="none" stroke="#e1ffdf" stroke-width="2" opacity=".16"/></g>`).join('\n  ')}
 </g>
 <g fill="url(#ink)" stroke="#0c2e21" stroke-width="1.8" stroke-linejoin="round">${sad?crying:happy}</g>
</g></svg>\n`;
}
for(const [name,options] of [['mascot.svg',{animated:true}],['mascot-crying.svg',{animated:true,sad:true}],['icon.svg',{}],['favicon.svg',{small:true}]])writeFileSync(fileURLToPath(new URL('../dist/'+name,import.meta.url)),svg(options));
