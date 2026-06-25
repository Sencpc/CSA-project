import { Spin, ConfigProvider } from 'antd';

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-pink-50">
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#f87171', // red-400 matches the theme
          },
          tip: {
            color: '#f87171',
          },
        }}
      >
        <Spin size="large" tip="Loading" />
      </ConfigProvider>
    </div>
  )
}

export default LoadingScreen
