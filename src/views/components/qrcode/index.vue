<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import QRCode from 'qrcode'
import { onMounted, ref, useTemplateRef, watch } from 'vue'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')
const qrCardClassName = cn('flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-lg')
const qrCanvasContainer = cn('p-4 bg-gray-50 dark:bg-gray-700 rounded-lg')

const basicText = ref('https://example.com')
const basicQrCanvas = useTemplateRef<HTMLCanvasElement>('basicQrCanvas')

async function generateBasicQR() {
  if (!basicQrCanvas.value)
    return
  try {
    await QRCode.toCanvas(basicQrCanvas.value, basicText.value, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }
  catch (error) {
    console.error('QR generation failed', error)
  }
}

watch(basicText, () => { generateBasicQR() })
onMounted(() => { generateBasicQR() })

const logoText = ref('https://antdv-next.com')
const logoQrCanvas = useTemplateRef<HTMLCanvasElement>('logoQrCanvas')
const showLogo = ref(true)

async function generateLogoQR() {
  if (!logoQrCanvas.value)
    return
  try {
    await QRCode.toCanvas(logoQrCanvas.value, logoText.value, {
      width: 200,
      margin: 2,
      color: { dark: '#1677ff', light: '#ffffff' },
    })
    if (showLogo.value) {
      const ctx = logoQrCanvas.value.getContext('2d')
      if (ctx) {
        const size = 40
        const x = (logoQrCanvas.value.width - size) / 2
        const y = (logoQrCanvas.value.height - size) / 2
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x - 4, y - 4, size + 8, size + 8)
        ctx.beginPath()
        ctx.arc(logoQrCanvas.value.width / 2, logoQrCanvas.value.height / 2, size / 2, 0, Math.PI * 2)
        ctx.fillStyle = '#1677ff'
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 16px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('A', logoQrCanvas.value.width / 2, logoQrCanvas.value.height / 2)
      }
    }
  }
  catch (error) {
    console.error('Logo QR generation failed:', error)
  }
}

watch([logoText, showLogo], () => { generateLogoQR() })
onMounted(() => { generateLogoQR() })

const downloadFormat = ref<'png' | 'svg' | 'dataURL'>('png')
const downloadQrCanvas = useTemplateRef<HTMLCanvasElement>('downloadQrCanvas')

async function generateDownloadQR() {
  if (!downloadQrCanvas.value)
    return
  try {
    await QRCode.toCanvas(downloadQrCanvas.value, 'Downloadable QR Code', {
      width: 200,
      margin: 2,
      color: { dark: '#52c41a', light: '#f6ffed' },
    })
  }
  catch (error) {
    console.error('Download QR generation failed', error)
  }
}

onMounted(() => { generateDownloadQR() })

function handleDownload() {
  if (!downloadQrCanvas.value)
    return
  if (downloadFormat.value === 'png') {
    const link = document.createElement('a')
    link.download = 'qrcode.png'
    link.href = downloadQrCanvas.value.toDataURL('image/png')
    link.click()
    message.success('PNG download success')
  }
  else if (downloadFormat.value === 'svg') {
    QRCode.toString('Downloadable QR Code', {
      type: 'svg',
      width: 200,
      margin: 2,
      color: { dark: '#52c41a', light: '#f6ffed' },
    }).then((svg: string) => {
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const link = document.createElement('a')
      link.download = 'qrcode.svg'
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
      message.success('SVG download success')
    })
  }
  else {
    QRCode.toDataURL('Downloadable QR Code', { width: 200, margin: 2 }).then((url: string) => {
      message.success(`Data URL generated, length: ${Math.round(url.length / 1024)}KB`)
    })
  }
}

const scanResult = ref('')
const scanning = ref(false)
const scanHistory = ref<string[]>([])

function simulateScan() {
  scanning.value = true
  scanResult.value = ''
  setTimeout(() => {
    const results = [
      'https://www.example.com/product/12345',
      'WIFI:T:WPA;S:NetworkName;P:Password123;;',
      'BEGIN:VCARD\nVERSION:3.0\nFN:Zhang San\nTEL:13800138000\nEND:VCARD',
      'mailto:contact@example.com?subject=Hello',
    ]
    const randomResult = results[Math.floor(Math.random() * results.length)]
    scanResult.value = randomResult
    scanHistory.value.unshift(randomResult)
    if (scanHistory.value.length > 5) { scanHistory.value.pop() }
    scanning.value = false
    message.success('Scan complete')
  }, 1500)
}

const errorCorrectionLevel = ref<'L' | 'M' | 'Q' | 'H'>('M')
const levelCanvases = {
  L: useTemplateRef<HTMLCanvasElement>('qrLevelL'),
  M: useTemplateRef<HTMLCanvasElement>('qrLevelM'),
  Q: useTemplateRef<HTMLCanvasElement>('qrLevelQ'),
  H: useTemplateRef<HTMLCanvasElement>('qrLevelH'),
}

const levelDescriptions = {
  L: { name: 'L (Low)', desc: '7% tolerance', percent: 7 },
  M: { name: 'M (Medium)', desc: '15% tolerance', percent: 15 },
  Q: { name: 'Q (Quartile)', desc: '25% tolerance', percent: 25 },
  H: { name: 'H (High)', desc: '30% tolerance', percent: 30 },
}

async function generateErrorCorrectionQRs() {
  for (const [level, canvasRef] of Object.entries(levelCanvases)) {
    const canvas = canvasRef.value
    if (canvas) {
      try {
        await QRCode.toCanvas(canvas, `Level: ${level}`, {
          width: 150,
          margin: 2,
          errorCorrectionLevel: level as any,
          color: { dark: '#1890ff', light: '#e6f7ff' },
        })
      }
      catch (error) {
        console.error(`Level ${level} QR failed:`, error)
      }
    }
  }
}

watch(errorCorrectionLevel, () => { generateErrorCorrectionQRs() })
onMounted(() => { generateErrorCorrectionQRs() })

const customSize = ref(200)
const customDarkColor = ref('#1677ff')
const customLightColor = ref('#ffffff')
const customText = ref('Custom QR Code')
const customQrCanvas = useTemplateRef<HTMLCanvasElement>('customQrCanvas')

async function generateCustomQR() {
  if (!customQrCanvas.value)
    return
  try {
    await QRCode.toCanvas(customQrCanvas.value, customText.value, {
      width: customSize.value,
      margin: 2,
      color: { dark: customDarkColor.value, light: customLightColor.value },
    })
  }
  catch (error) {
    console.error('Custom QR generation failed:', error)
  }
}

watch([customSize, customDarkColor, customLightColor, customText], () => { generateCustomQR() })
onMounted(() => { generateCustomQR() })

const colorPresets = [
  { name: 'B&W', dark: '#000000', light: '#ffffff' },
  { name: 'Blue', dark: '#1677ff', light: '#e6f7ff' },
  { name: 'Green', dark: '#52c41a', light: '#f6ffed' },
  { name: 'Red', dark: '#ff4d4f', light: '#fff2f0' },
  { name: 'Purple', dark: '#722ed1', light: '#f9f0ff' },
  { name: 'Orange', dark: '#fa8c16', light: '#fff7e6' },
]

function applyPreset(preset: typeof colorPresets[0]) {
  customDarkColor.value = preset.dark
  customLightColor.value = preset.light
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    message.success('Copied to clipboard')
  })
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="Basic QR Code">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Enter text or URL to generate a QR code in real-time
      </p>
      <div class="max-w-md mx-auto space-y-4">
        <a-input
          v-model:value="basicText"
          placeholder="Enter text or URL"
          allow-clear
          size="large"
        />
        <div :class="qrCardClassName">
          <div :class="qrCanvasContainer">
            <canvas ref="basicQrCanvas" />
          </div>
          <p class="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
            Scan to visit: {{ basicText || '(empty)' }}
          </p>
        </div>
      </div>
    </a-card>

    <a-card title="QR Code with Logo">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Add a brand logo in the center of the QR code
      </p>
      <div class="max-w-md mx-auto space-y-4">
        <div class="flex gap-4 items-center">
          <a-input
            v-model:value="logoText"
            placeholder="Enter content"
            allow-clear
            class="flex-1"
          />
          <a-switch
            v-model:checked="showLogo"
            checked-children="Logo"
            un-checked-children="No Logo"
          />
        </div>
        <div :class="qrCardClassName">
          <div :class="qrCanvasContainer">
            <canvas ref="logoQrCanvas" />
          </div>
          <p class="mt-4 text-sm text-gray-500 text-center">
            Tip: Use professional logo images in production
          </p>
        </div>
      </div>
    </a-card>

    <a-card title="Download QR Code">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Export in multiple formats: PNG, SVG, Data URL
      </p>
      <div class="max-w-md mx-auto space-y-4">
        <div class="flex gap-2 flex-wrap justify-center">
          <a-radio-group
            v-model:value="downloadFormat"
            button-style="solid"
          >
            <a-radio-button value="png">
              PNG
            </a-radio-button>
            <a-radio-button value="svg">
              SVG
            </a-radio-button>
            <a-radio-button value="dataURL">
              Data URL
            </a-radio-button>
          </a-radio-group>
        </div>
        <div :class="qrCardClassName">
          <canvas ref="downloadQrCanvas" />
          <a-button
            type="primary"
            class="mt-4"
            @click="handleDownload"
          >
            <template #icon>
              <Icon icon="carbon:download" />
            </template>
            Download ({{ downloadFormat.toUpperCase() }})
          </a-button>
        </div>
      </div>
    </a-card>

    <a-card title="Scan Simulation">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Simulate scanning a QR code with a scanner or camera
      </p>
      <div class="max-w-lg mx-auto space-y-4">
        <div class="flex justify-center">
          <a-button
            type="primary"
            size="large"
            :loading="scanning"
            @click="simulateScan"
          >
            <template #icon>
              <Icon icon="carbon:scan" />
            </template>
            {{ scanning ? 'Scanning...' : 'Simulate Scan' }}
          </a-button>
        </div>
        <div
          v-if="scanResult"
          class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
        >
          <div class="flex items-start gap-2">
            <Icon
              icon="carbon:checkmark-filled"
              class="text-green-500 text-xl mt-0.5"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-green-700 dark:text-green-300 mb-1">
                Scan Success
              </p>
              <code class="block p-2 bg-white dark:bg-gray-800 rounded text-sm break-all">{{ scanResult }}</code>
            </div>
          </div>
        </div>
        <div v-if="scanHistory.length > 0">
          <h4 class="font-medium mb-2 flex items-center gap-2">
            <Icon icon="carbon:time" />
            Scan History
          </h4>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <div
              v-for="(result, index) in scanHistory"
              :key="index"
              class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              @click="copyToClipboard(result)"
            >
              <div class="flex items-start justify-between gap-2">
                <code class="flex-1 break-all">{{ result }}</code>
                <Icon
                  icon="carbon:copy"
                  class="text-gray-400 hover:text-blue-500 flex-shrink-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <a-card title="Error Correction Levels">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Higher correction levels recover more data but produce more complex patterns
      </p>
      <div class="mb-4">
        <a-radio-group
          v-model:value="errorCorrectionLevel"
          button-style="solid"
        >
          <a-radio-button value="L">
            L - Low
          </a-radio-button>
          <a-radio-button value="M">
            M - Medium
          </a-radio-button>
          <a-radio-button value="Q">
            Q - Quartile
          </a-radio-button>
          <a-radio-button value="H">
            H - High
          </a-radio-button>
        </a-radio-group>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="(level, key) in levelDescriptions"
          :key="key"
          :class="qrCardClassName"
          class="!p-4"
        >
          <canvas :ref="(el: any) => (levelCanvases[key as keyof typeof levelCanvases] = el)" />
          <h5 class="font-medium mt-3 text-center">
            {{ level.name }}
          </h5>
          <p class="text-xs text-gray-500 text-center mt-1">
            {{ level.desc }}
          </p>
        </div>
      </div>
    </a-card>

    <a-card title="Size and Color Customization">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Customize the size, foreground and background colors
      </p>
      <div class="max-w-lg mx-auto space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">Content</label>
          <a-input
            v-model:value="customText"
            placeholder="Enter content"
            allow-clear
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">
            Size: {{ customSize }}px x {{ customSize }}px
          </label>
          <a-slider
            v-model:value="customSize"
            :min="100"
            :max="400"
            :step="10"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Foreground</label>
            <input
              v-model="customDarkColor"
              type="color"
              class="w-full h-10 rounded cursor-pointer"
            >
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Background</label>
            <input
              v-model="customLightColor"
              type="color"
              class="w-full h-10 rounded cursor-pointer"
            >
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Preset Color Schemes</label>
          <div class="flex gap-2 flex-wrap">
            <a-button
              v-for="preset in colorPresets"
              :key="preset.name"
              size="small"
              @click="applyPreset(preset)"
            >
              <span
                class="inline-block w-3 h-3 rounded-full mr-1"
                :style="{ backgroundColor: preset.dark }"
              />
              {{ preset.name }}
            </a-button>
          </div>
        </div>
        <div :class="qrCardClassName">
          <div
            :class="qrCanvasContainer"
            :style="{ backgroundColor: customLightColor }"
          >
            <canvas ref="customQrCanvas" />
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>
