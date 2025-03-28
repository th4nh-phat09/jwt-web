import axios from 'axios'
import { toast } from 'react-toastify'
import { logOutAPI, refreshTokenAPI } from '~/apis'


// https://axios-http.com/docs/interceptors
let authorizedAxiosInstance = axios.create()

// Thời gian cho tôi đó của 1 request:  10 phút
authorizedAxiosInstance.defaults.timeout = 1000 * 60 * 10
// cho phép axios tự động gửi cookie trong mỗi request lên BE (phục vụ việc chúng ta sẽ
// lưu JWT tokens (refresh & access) vào trong httpOnly Cookie của trình duyệt)
// và tự động set cookie vào trình duyệt nếu BE gửi lên
authorizedAxiosInstance.defaults.withCredentials = true

// Add a request interceptor
authorizedAxiosInstance.interceptors.request.use((config) => {
  // Do something before request is sent
  const accessToken = localStorage.getItem('accessToken')
  //Bearer là để cho server biết ta đang gửi lên loại token nào
  if ( accessToken )
    config.headers.Authorization = `Bearer ${accessToken}`
  return config
}, (error) => {
  // Do something with request error
  return Promise.reject(error)
})

// Add a response interceptor
authorizedAxiosInstance.interceptors.response.use((response) => {
  return response
}, async (error) => {
  //Khu vực xử lý tự động gửi lại refresh tự động cho để tạo lại accessToken
  //Đối với BE nếu tar về mã lỗi 401 thì đá nó ra login
  if (error.response?.status === 401 ) {
    await logOutAPI()
    location.href = '/login'
  }
  //đầu tiên phải lấy được các request API bị lỗi lên server
  const originalRequest = error.config
  //console.log('🚀 ~ authorizedAxiosInstance.interceptors.response.use ~ originalRequest:', originalRequest)
  // originalRequest._retry là để không gọi đồng thời nhiều API refreshToken một lúc
  //ví dụ như chỗ gọi api refresh token trong dashboard gọi 2 APi đó 2 lần trong cùng một useEffect
  if (error.response?.status === 410 && !originalRequest._retry) {
    originalRequest._retry = true
    // đối vơi trường hợp cookie thì chỉ cần gọi lại API refreshToken thì BE tự động set accessToken vào cookie lại cho ta rồi

    //lấy refresh token lại để làm tham số gọi API refreshToken
    //Với trường hợp cookie thì ko cần lấy ra vì nó tự gửi kèm theo cookie
    //với trường hợp localStorage thì lấy ra
    const refreshToken = localStorage.getItem('refreshToken')

    try {
      //Gọi API refresh để tạo lại accessToken
      const res = await refreshTokenAPI(refreshToken)

      //lấy ra accessToken mới được gửi lại và gán nó vào localStorage,còn cookie thì nó tự set
      const { accessToken } = res.data
      localStorage.setItem('accessToken', accessToken)

      // gắn lại vào header để gửi lại lên server
      authorizedAxiosInstance.defaults.headers.Authorization = `Bearer ${accessToken}`

      //gọi lại các API accessToken lỗi để đăng nhâp lại
      return authorizedAxiosInstance(originalRequest)
    } catch (_error) {
      await logOutAPI()
      location.href = '/login'
      return Promise.reject(_error)
    }
    //   return refreshTokenAPI(refreshToken)
    //     .then( (res) => {
    //       //lấy ra accessToken mới được gửi lại và gán nó vào localStorage,còn cookie thì nó tự set
    //       const { accessToken } = res.data
    //       localStorage.setItem('accessToken', accessToken)

    //       // gắn lại vào header để gửi lại lên server
    //       authorizedAxiosInstance.defaults.headers.Authorization = `Bearer ${accessToken}`

    //       //gọi lại các API accessToken lỗi để đăng nhâp lại
    //       return authorizedAxiosInstance(originalRequest)
    //     })
    //     .catch(_error => {
    //       logOutAPI()
    //       //location.href = '/login'
    //       return Promise.reject(_error)
    //     })

  }


  let errorMessage = error?.message
  if (error.response?.data?.message)
    errorMessage = error.response?.data?.message

  //toast error ra tru 410 vi de refresh token
  if (error.status === 410 )
    toast.error(errorMessage)
  return Promise.reject(error)
})

export default authorizedAxiosInstance