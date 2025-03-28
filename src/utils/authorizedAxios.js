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

// Biến để lưu trữ promise của API refresh token, giúp ngăn gọi nhiều lần
let refreshTokenPromise = null

// Thêm interceptor xử lý response
authorizedAxiosInstance.interceptors.response.use(
  (response) => response, // Nếu response thành công thì trả về luôn
  async (error) => {

    //Nếu bị lỗi 401 (Unauthorized) → Đăng xuất và chuyển hướng đến trang login
    if (error.response?.status === 401) {
      await logOutAPI() // Gọi API logout
      location.href = '/login' // Chuyển về trang đăng nhập
      return Promise.reject(error)// Trả về lỗi
    }

    //Lấy request gốc bị lỗi để retry sau khi có token mới
    const originalRequest = error.config

    //Nếu lỗi là 410 (Token hết hạn) thì xử lý refresh token
    if (error.response?.status === 410 && originalRequest) {
      // Lấy refreshToken từ localStorage
      const refreshToken = localStorage.getItem('refreshToken')

      //Nếu chưa có refreshTokenPromise thì gọi API refresh
      if (!refreshTokenPromise) {
        refreshTokenPromise = refreshTokenAPI(refreshToken)
          .then((res) => {

            // Lấy accessToken mới từ response
            const { accessToken } = res.data

            // Lưu vào localStorage
            localStorage.setItem('accessToken', accessToken)

            // Cập nhật vào header mặc định
            authorizedAxiosInstance.defaults.headers.Authorization = `Bearer ${accessToken}`
          })
          .catch(async (_error) => {
            // Nếu refresh thất bại → Đăng xuất
            await logOutAPI()
            location.href = '/login'
            // Trả lỗi để request biết refresh thất bại
            return Promise.reject(_error)
          })
          .finally(() => {
            // ✅ Sau khi refresh xong, reset lại để lần sau gọi
            refreshTokenPromise = null
          })
      }
      //goi lai cac api loi
      return refreshTokenPromise.then(() => {
        return authorizedAxiosInstance(originalRequest)
      })
    }
    let errorMessage = error?.message
    if (error.response?.data?.message) errorMessage = error.response?.data?.message

    if (error.status === 410) toast.error(errorMessage) // Hiển thị lỗi nếu là 410
    return Promise.reject(error) // Trả lỗi về để xử lý ở chỗ gọi API
  }
)

export default authorizedAxiosInstance