# Video qo'llanma

"Profilga ulash" bo'limidagi QISQA video shu papkadan olinadi.

## Nima qilish kerak

Videoni shu yerga `guide.mp4` nomi bilan tashlang:

    miniapp/media/guide.mp4

Tamom. Server uni `/app/media/guide.mp4` manzilida beradi va Mini App
ichida, hech qayerga chiqmasdan o'ynaydi.

Boshqa nom kerak bo'lsa `.env` da `PROFILE_LINK_VIDEO_FILE=boshqa.mp4`.

## Tavsiyalar

| Nima          | Qiymat                                    |
|---------------|-------------------------------------------|
| Format        | MP4 (H.264 + AAC) — hamma qurilmada ochiladi |
| Uzunligi      | 30-60 soniya                              |
| O'lchami      | 720p yetarli, 1080p shart emas            |
| Hajmi         | 10 MB dan oshmasin — mobil internetda tez ochilsin |

Siqish (ffmpeg):

    ffmpeg -i asl.mp4 -vf "scale=-2:720" -c:v libx264 -crf 28 \
           -preset slow -c:a aac -b:a 96k -movflags +faststart guide.mp4

`-movflags +faststart` MUHIM: busiz video to'liq yuklanmaguncha
o'ynamaydi.

## To'liq qo'llanma

Uzunroq video YouTube'da tursin — `.env` dagi
`PROFILE_LINK_YOUTUBE_URL` ga havolasini qo'ying, u "Batafsil"
tugmasi bo'lib chiqadi.
