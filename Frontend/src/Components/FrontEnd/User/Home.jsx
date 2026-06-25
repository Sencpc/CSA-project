import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import Model1 from '../../../assets/SharedAsset/Model1.jpg'
import Model2 from '../../../assets/SharedAsset/Model2.jpg'
import Model3 from '../../../assets/SharedAsset/Model3.jpg'
import { ClockCircleOutlined, StarFilled, WhatsAppOutlined } from '@ant-design/icons'
import { Button, Card, Typography } from 'antd'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [settings, setSettings] = useState(null)
  
  const slides = [
    {
      id: 1,
      image: Model1
    },
    {
      id: 2,
      image: Model2
    },
    {
      id: 3,
      image: Model3
    }
  ]

  // Auto-play carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(interval)
  }, [slides.length])

  useEffect(() => {
    const controller = new AbortController()

    const loadSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings/public`, {
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.message || 'Failed to load settings')
        }
        setSettings(payload?.settings ?? null)
      } catch (error) {
        if (error?.name === 'AbortError') return
        console.error(error)
        setSettings(null)
      }
    }

    loadSettings()

    return () => controller.abort()
  }, [])

  const homeInfo = useMemo(() => {
    const general = settings?.general ?? {}

    const phoneRaw =
      typeof general.phone === 'string' && general.phone.trim().length > 0
        ? general.phone.trim()
        : '089-854-525-596'

    const phoneDigits = phoneRaw.replace(/\D/g, '')

    const address =
      typeof general.address === 'string' && general.address.trim().length > 0
        ? general.address.trim()
        : 'Jl. Gubeng Kertajaya V F Blok F No.32, Airlangga, Kec. Gubeng, Surabaya\nRT.007/RW.03'

    const hours = Array.isArray(general.hours) ? general.hours : []

    return {
      phoneText: phoneRaw,
      whatsappHref: phoneDigits ? `https://wa.me/${phoneDigits}` : 'https://wa.me/628985452559',
      addressLines: address.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      hours,
    }
  }, [settings])

  return (
    <div className="bg-white">
      {/* Carousel - 75vh */}
      <section className="relative w-full overflow-hidden" style={{ height: '100vh' }}>
        {/* Slides */}
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Background Image - Full Screen */}
            <div 
              className="w-full h-full bg-cover bg-center bg-no-repeat"
              style={{ 
                backgroundImage: `url(${slide.image})`
              }}
            />
          </div>
        ))}
      </section>

      <section className="relative -mt-24 z-10 mb-16">
        <div className="container mx-auto px-6">
          <Card
            bordered={false}
            className="bg-white rounded-3xl shadow-xl"
            styles={{ body: { padding: 0 } }}
          >
            <div className="px-6 sm:px-8 md:px-12 py-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-16 text-gray-800 max-w-6xl mx-auto">
            <div className="flex flex-col items-center text-center md:text-left md:items-start w-full">
              <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4 text-gray-900">Layanan pelanggan</h2>
              <a href={homeInfo.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-red-400 transition-colors">
                <div className="w-10 h-10 bg-red-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <WhatsAppOutlined style={{ fontSize: '24px', color: '#ffffff' }} />
                </div>
                <span className="text-base md:text-lg">{homeInfo.phoneText}</span>
              </a>
            </div>
            <div className="flex flex-col items-center text-center md:text-left md:items-start w-full">
              <h2 className="text-lg font-bold mb-4 text-gray-900">Kantor pusat</h2>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-base leading-relaxed">
                  {homeInfo.addressLines.map((line, index) => (
                    <p key={`address-line-${index}`}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center text-center md:text-left md:items-start w-full md:ml-10">
              <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4 text-gray-900">Jam operasional</h2>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <ClockCircleOutlined style={{ fontSize: '24px', color: '#ffffff' }} />
                </div>
                <div className="text-base leading-relaxed">
                  {homeInfo.hours.length > 0 ? (
                    homeInfo.hours.map((row, index) => (
                      <p key={`hour-row-${index}`}>
                        {row?.day}: {row?.open} - {row?.close}
                      </p>
                    ))
                  ) : (
                    <>
                      <p>Open Tuesday - Sunday</p>
                      <p>9.00 - 18.00</p>
                    </>
                  )}
                </div>
              </div>
            </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-gradient-to-b from-white to-pink-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <Typography.Title
              level={2}
              className="text-4xl font-bold text-gray-900"
              style={{ margin: 0, marginBottom: '0.75rem' }}
            >
              Our Services
            </Typography.Title>
            <div className="w-24 h-1 bg-red-400 mx-auto rounded-full"></div>
          </div>
          
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Service Item */}
            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <StarFilled style={{ fontSize: '20px', color: '#f87171' }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Cutting / Blow</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <StarFilled style={{ fontSize: '20px', color: '#f87171' }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Creambath</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <StarFilled style={{ fontSize: '20px', color: '#f87171' }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Make Up</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <StarFilled style={{ fontSize: '20px', color: '#f87171' }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Massage</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Pelurusan / Smoothing / Ion</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Pengeritingan</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Pewarnaan / Highlight</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Cuci Blow / Blow Extension</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Hair Extension</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Facial</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Manicure Pedicure</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Perawatan Badan</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Hair Mask</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Body Spa</h3>
                </div>
              </div>
            </Card>

            <Card bordered={false} className="bg-white rounded-xl shadow-md border border-pink-100" styles={{ body: { padding: 0 } }}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-none">Hair Spa</h3>
                </div>
              </div>
            </Card>
          </div>

          <div className="text-center mt-12">
            <Link to="/customer/book">
              <Button 
                type="primary"
                style={{
                  backgroundColor: '#f87171',
                  color: 'white',
                  fontWeight: 600,
                  height: 'auto',
                  padding: '12px 40px', 
                  borderRadius: '9999px', 
                  fontSize: '16px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                }}
              >
                View Services
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default Home