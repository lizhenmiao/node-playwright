const cookiesConfig = [{
  zipCode: 10008,
  // 美国
  domain: 'amazon.com',
  // 这里需要注意, 每个站点的 cookie 都需要去对应站点获取, 例如: 美国 -> amazon.com, 加拿大 -> amazon.ca
  cookie: 'session-id=145-7372270-8877416; session-id-time=2082787201l; i18n-prefs=USD; lc-main=en_US; ubid-main=134-0881753-6888449; aws-ubid-main=426-3867378-0843573; aws-target-data=%7B%22support%22%3A%221%22%7D; aws-target-visitor-id=1756790415508-142595.42_0; aws-userInfo-signed=eyJ0eXAiOiJKV1MiLCJrZXlSZWdpb24iOiJ1cy1lYXN0LTEiLCJhbGciOiJFUzM4NCIsImtpZCI6IjQ1YzkxMTJjLTEwZDMtNDk5NS04NzI2LWQ5ZWQ3ODA0MjYzNSJ9.eyJzdWIiOiIiLCJzaWduaW5UeXBlIjoiUFVCTElDIiwiaXNzIjoiaHR0cHM6XC9cL3NpZ25pbi5hd3MuYW1hem9uLmNvbVwvc2lnbmluIiwia2V5YmFzZSI6IkQ4V2RzUWJMd2dIRGJnUVA5SDVrSTJhWTFROVZvSDJVU09hdkxYYnRXOFU9IiwiYXJuIjoiYXJuOmF3czppYW06OjUzNjk0MTUzMzA0NTpyb290IiwidXNlcm5hbWUiOiJsaXpoZW5taWFvIn0.7Jlab6Dt44SjMyaY63-jHi17QmbgwKa1oV2kQSPtjuvaAFMVD8OIw_l3TDMK5O0rcN4dD7c830f-TnVUrY2yRvXpi__3lSj0LQpl_fAgsGswdZnSl3nhscV6twe2zt3b; aws-userInfo=%7B%22arn%22%3A%22arn%3Aaws%3Aiam%3A%3A536941533045%3Aroot%22%2C%22alias%22%3A%22%22%2C%22username%22%3A%22lizhenmiao%22%2C%22keybase%22%3A%22D8WdsQbLwgHDbgQP9H5kI2aY1Q9VoH2USOavLXbtW8U%5Cu003d%22%2C%22issuer%22%3A%22https%3A%2F%2Fsignin.aws.amazon.com%2Fsignin%22%2C%22signinType%22%3A%22PUBLIC%22%7D; noflush_awsccs_sid=4db2ef4b5e5c509a65dc54351940199de4fa15478a26e5f20048bf065a43fc3a; aws-target-static-id=1756791034439-159470; s_fid=73C96F43A4FA60D8-20446911D92AB2B3; s_vn=1788327034638%26vn%3D1; s_dslv=1756791050224; s_nr=1756791050225-New; AMCV_7742037254C95E840A4C98A6%40AdobeOrg=1585540135%7CMCIDTS%7C20334%7CMCMID%7C80785690814607686846045575199442433035%7CMCAID%7C343AFAADD50278F0-60000464A2F1DBB4%7CMCOPTOUT-1756798268s%7CNONE%7CvVersion%7C4.4.0%7CMCAAMLH-1757395868%7C9%7CMCAAMB-1757395868%7Cj8Odv6LonN4r3an7LhD3WZrU1bUpAkFkkiY1ncBR96t2PTI; kndctr_7742037254C95E840A4C98A6_AdobeOrg_consent=general=in; regStatus=registering; skin=noskin; kndctr_7742037254C95E840A4C98A6_AdobeOrg_identity=CiY4MDc4NTY5MDgxNDYwNzY4Njg0NjA0NTU3NTE5OTQ0MjQzMzAzNVIQCOy2oceQMxgBKgNPUjIwA_ABzOKwi5Mz; session-token=4H/kp/XPWqJEgxl0/Oid708Zzd21XX+A9TuPvT5U4IHxkCgv+yNc3++7Bq6f+aK6gOZMebPHePsLKJRsZIQD7GjkRWUgXkNNjuX/66WauxnGTif8Lcxv7iWgQOAhxZvhzaVGaB/VMnMOnkH7UhhSzydowzkkOuwCHXcoehXC5+0Ma4SGHzy2wEJmP/e1xUIdAH/b3M7iWAxRmMaMmfzqThFFfF0YPqFtoSnMPMrJgVzb7miZXdFFzHfJNUK+57s7egaJLwkUmYF0nvXhXEaCpGznZPc28OIbq2EUbD9pHN7YvUPDL4HGladucfTdGn/wc252UBnUi9rXBRKQo1Mg/ezr79+LSgTr; csm-hit=tb:BZ3Z9XF9R6E7BQKEH8QS+s-BZ3Z9XF9R6E7BQKEH8QS|1757571760759&t:1757571760759&adb:adblk_no; rxc=ALzTsF2ggf5f2oQOrsM'
}, {
  zipCode: 'W1B 4DG',
  // 英国
  domain: 'amazon.co.uk',
  cookie: 'x-amz-captcha-1=1757647622971893; x-amz-captcha-2=KwcPh666p/uY1+Vepk0SAg==; session-id=524-1631986-7813768; session-id-time=2082787201l; i18n-prefs=GBP; lc-acbuk=en_GB; ubid-acbuk=522-9243226-7531148; session-token="zxMMTsYOLanHYH3NZwdyABU2eJHAW/Qvhk6Lf4Ojn/q/cSnpGczwp/Eq3+trYEsvMdOfTAPUoyNzjakV8VxCIEiVd/A9UaPOfh5HtJGQMJ30GiUTz+UWqRTyYGM2Ngq9SoPzOfl5ItGZdnoCO8XqZUw52WsiydWPy6lPma2GG5uOG2y5sSdT0uDtOfAdhvdHBfE7eeoO2va+e6y7vCepfrIUr3H2ArJa0fR8NSXQJxaRM00WGRxDHrAhrlduAH+a/DUVFitMOGv/V7zmr6MmdsBHUHpSgpfulVFTN+Zz++ZKeE8fb3gM9kaoJKYxOHHuOl0Adgp5DujicwOVLwnxmJkc4z0N8MB9WQ/Xk+1PTL8="; csm-hit=tb:ZPH9Z4NFJNNSP75PJPB3+s-32KJZ5F393700R7WF5DT|1757640463632&t:1757640463632&adb:adblk_no; rxc=ABYGk+Y4Kgk4cOdaV1E'
}, {
  zipCode: 'K1A 0A9',
  // 加拿大
  domain: 'amazon.ca',
  cookie: 'csm-sid=473-5328030-6784468; x-amz-captcha-1=1757647739841093; x-amz-captcha-2=Om/7W2wxVPWKBAq2mFn2og==; session-id=136-1837375-0224660; session-id-time=2082787201l; i18n-prefs=CAD; lc-acbca=en_CA; ubid-acbca=132-5928466-9815763; session-token=x8swTTl3JD9o0sXP8fHc2POJtvW0ozpcT+eU04wYy49KWifCj0/eHECyQtepPVp4i0NpjqhrVeTDkd9uD04CczbuGZVeLiZjJBTvgyPh/DrmbqEy1M+e+Xg3P3VBLP5mQQlvNSvtuwQ/NIEY7UN0lwohDpLw8VrcskqWfutrqxez9soCyFo61HHgidDAp/bLPNCl/G8609QIoAjw0uW9eOmjQhR73mt1R5gUb4d7nQtOZhT/pB2Dmv3+VRYoI79iwkBsLM8qlbll66wtwh8H6SMCufpWI84fw8HYqOem3fYdpHfe8NZoGah2F9KuEESe/2WgBdPvMfd7SoYYfJtfvX0r+AIf9TLh; csm-hit=tb:ZXBHHCPG6YPJKV1K13N4+s-94BMJ6J5J24353H386FP|1757640575897&t:1757640575897&adb:adblk_no; rxc=AGwBC/LCIVBe/yApAfU'
}, {
  zipCode: '110-0008',
  // 日本
  domain: 'amazon.co.jp',
  cookie: 'csm-sid=318-9661058-1684875; x-amz-captcha-1=1757932171196392; x-amz-captcha-2=X6erKfXqWAXfI/csajWzsg==; session-id=355-5586931-5962701; session-id-time=2082787201l; i18n-prefs=JPY; lc-acbjp=en_US; skin=noskin; ubid-acbjp=356-2833166-9195704; session-token="UTQPd4S/KuPV5n4KMSzUC5OKc1qKqizVeWBGJ9EvECOTnMB5AucThwKe+9SeVWXNROne8dGYsSHQ7Bm7HGZOy85Li5VyynJ7GB+Gczlk786pJ0AcFs2WXGatuJOXzgC+0PbbQ7OM7CqH+Sp8Lm9pw+oj48jmolUHMMI8axzm8voMcvrQgfRb/zV6zZN05LEmaoadSKIC8vwtcqpt1maQ1KRAQouSF6lPPXXouSEL9/cOupq0u5Kg1o7vP2xdf8YfslFf90CGMtTCZuTpaD8ppkebDPHMinvT32LreEM4lJSgi5kRddEAmoiqGavohJT9ts/9O90VpHZ4YmDlnt1uvawPoKrWHGFRrYigeDFEBpk="; csm-hit=tb:1AN594S9ANGA8ENNMZ94+s-HA4BCQZNA17AMRN1S7A3|1757925122080&t:1757925122080&adb:adblk_no; rxc=AGQgLV9sbiv3W24Dz0A'
}, {
  zipCode: 20099,
  // 德国
  domain: 'amazon.de',
  cookie: 'csm-sid=581-6895210-0219660; x-amz-captcha-1=1757932467048387; x-amz-captcha-2=vlLYIs4ZQ6WJE5n6GVxbpQ==; session-id=261-8602632-0459265; session-id-time=2082787201l; i18n-prefs=EUR; lc-acbde=en_GB; ubid-acbde=262-2626969-5612269; session-token=Q2dQT0WHHniGc89uG41E95/U4vFVpm21XvUqPlcEGTRq9ucDSL4OvZ2nc0SQ3jIKb2z8uegv6IJRfXtUI1nisc8Wm9JhFsYxysuDbtecEvK7zHC8CWacBFpOIIG8PTVdvz8dDUdRM26lFRpgVfUcsSrpllmoA8csQpPrXd2Yuf2B6B/68ZrwTkQz+aHQzKiAaTcQLU8LHEEyDCA+wi4JmLFiRKs+Gs5xPISe6APNjJh+tDMTqFMeOmEGnQWNhYWMD1x2n+V5MefN59egBBR1YFZpWTR+vPpBNmXwwgpdNa2YZJus0X0sP+vVLU9sUIE/ay/J4Ieh9OxBXny96TlKwudiQCk5THL5; csm-hit=tb:HQWQAJXYQMHJ9JG8VV3Q+s-B32PA8BCWV26PPTVDX12|1757925304510&t:1757925304510&adb:adblk_no; rxc=AMLOcZRKq+Lmhqvn7H4'
}, {
  zipCode: 75000,
  // 法国
  domain: 'amazon.fr',
  cookie: 'csm-sid=999-2470330-3003100; x-amz-captcha-1=1757932557954447; x-amz-captcha-2=7pW+ajJUvV8mNkAJl5Ii9Q==; session-id=520-3085030-8516753; session-id-time=2082787201l; i18n-prefs=EUR; lc-acbfr=en_GB; ubid-acbfr=261-8474071-5403838; session-token=TBIPlvTYor3y8A3r9Aa6FGogAsAOhZdFvOStuSEkQ1j0ktVKfgb5K6JvLCOogCTE5KpwTAVq/MU/IqsvzSCnSHI7eV5N2hWGP2b1lUyt/cEqqkqueXn6PvdNq3G0YppxSpsrKlnE7ynD0Ct3vjKkaLCudUDtmJo1m3Vy6m8M4wWY/Xj3vkDZBOqLKoQWYOGlBxoNQ+mfYw4I+sJXXqaqVtZmGsj4RS4jtWTP/Xb6fOKlWaL+laYQIwqu0XN5d5AbwIJeEAlgn4hVDHgqbTA4yCyPMAmKrBP35b1Z7tBZKUDCp2/uYsPHEc+M8eE0nQVqxJ3q7zm8agOmioDKxmC1srCSRUjSUBTs; csm-hit=tb:KXGPEBWKS2YXCSH9890N+s-60XV55W1G7667W11ZM8B|1757925390578&t:1757925390578&adb:adblk_no; rxc=AMdaJMl7Zzp1mAVs6vQ'
}, {
  zipCode: 20123,
  // 意大利
  domain: 'amazon.it',
  cookie: 'csm-sid=879-4984110-7475506; x-amz-captcha-1=1757932634487635; x-amz-captcha-2=oXlpFDy+HveX5P0ft9Or+A==; session-id=525-6065176-7724220; session-id-time=2082787201l; i18n-prefs=EUR; lc-acbit=en_GB; ubid-acbit=260-0654361-7558928; session-token=259yzuNCFa4flyIgKaRrd9s/Kvjsh63wTiYNljw854RrACMG+Fq468x+X6X3GFeLWRYmxhF50UxwSIOxI71SdezzWZQl8zBpgv5AZqH1JDRvn/HPFdqVgub6PDpCTOYWNxFIj7f3tOk51QodHBlBVNWepaUDyFS1DtIvlWRa5dFUWXUDVao2OHselgaJ1PsMnPCUpQItnHWLISiWT5Qq0tKJfzN4YA3GYKHOTKaRUUWRa+dTiiwk2//BGmyssG0DAzmCimOmPLeRyo6oG3+HYo9BOvn823Ux+M64kFkIOkkhjkL8BsPDKkU1MHB3zkI4OaEmEcsX/hVtYGzC/+RbZCHw56/GqIac; rxc=AOrihcXYx1ff9NzR6cY; csm-hit=tb:15Y9E6K9RFYP0N1JVY8G+s-551CNZ4R15QQT20J5CKG|1757925505423&t:1757925505423&adb:adblk_no'
}, {
  zipCode: 28028,
  // 西班牙
  domain: 'amazon.es',
  cookie: 'csm-sid=512-4686627-3486702; x-amz-captcha-1=1757932759516726; x-amz-captcha-2=HGIwDLVoCldzRe7cjEPGCQ==; session-id=525-0295903-4285848; session-id-time=2082787201l; i18n-prefs=EUR; lc-acbes=en_GB; ubid-acbes=261-4253942-2830160; session-token=YKzfjRyWk9kh+SKuLXzvYdzaZ+dRpibAhGjMBKmq8MPmKQB42JJC6HuXOdgzsqREbc8/lR1O+KheMGYtEb305++Kz+XDPrrdfuuDLHsChULUmhKem3wJTD1FzVezR39oqEvsRTVSaK6Xs2xYSJBM7B3XS1VBu73Qlof5j9k6dH0etOfHVxrXMK9pH5XwwO8NHjDS5RL8h1NLTckKsaVBXXVYQGh6ttaPynxdL6gBNYdiEU0BFcxOGLG/SDsAqRt0XkXwxys2zF74OueICF7MeYKWcavlTJSVptnRggDhHDYyDp1lb5XIGeQ/2fXFm//DUkymNqkLWyA0UskRKGlznbHq230oDKo/; csm-hit=tb:4RAM8J3CNPZ6KY0B0QSS+s-4SHQJ71HVXN6A42HT9RT|1757925591911&t:1757925591911&adb:adblk_no; rxc=ALZmkiFJ4RS7mrWU6n4'
}]

module.exports = {
  cookiesConfig
}