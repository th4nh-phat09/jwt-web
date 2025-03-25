import axios from 'axios'
import { toast } from 'react-toastify'

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
}, (error) => {

  let errorMessage = error?.message
  if (error.response?.data?.message)
    errorMessage = error.response?.data?.message
  //toast error ra tru 410 vi de refresh token
  if (error.status != 410 )
    toast.error(errorMessage)
  return Promise.reject(error)
})

export default authorizedAxiosInstance