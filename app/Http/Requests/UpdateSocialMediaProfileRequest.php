<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSocialMediaProfileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'nama_lengkap' => ['required', 'string', 'max:255'],
            'link_youtube' => ['nullable', 'string', 'max:500'],
            'total_subscribe_youtube' => ['nullable', 'integer', 'min:0'],
            'link_instagram' => ['nullable', 'string', 'max:500'],
            'total_follower_ig' => ['nullable', 'integer', 'min:0'],
            'link_tiktok' => ['nullable', 'string', 'max:500'],
            'total_follower_tiktok' => ['nullable', 'integer', 'min:0'],
            'link_facebook' => ['nullable', 'string', 'max:500'],
            'total_follower_fb' => ['nullable', 'integer', 'min:0'],
            'no_hp' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'tanggal_lahir' => ['nullable', 'integer', 'min:1', 'max:31'],
            'bulan_lahir' => ['nullable', 'string', 'max:50'],
            'ukuran_helm' => ['nullable', 'string', 'max:20'],
            'ukuran_jaket' => ['nullable', 'string', 'max:20'],
            'ukuran_sarung_tangan' => ['nullable', 'string', 'max:20'],
            'ukuran_sepatu' => ['nullable', 'string', 'max:20'],
            'alamat_rumah' => ['nullable', 'string'],
            'domisili' => ['nullable', 'string', 'max:255'],
        ];
    }
}
