<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSocialMediaPostingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'social_media_profile_id' => ['required', 'integer', 'exists:social_media_profiles,id'],
            'jenis_sosmed' => [
                'required',
                'string',
                Rule::in(['ig', 'TikTok', 'facebook', 'youtube']),
            ],
            'tanggal_rilis' => ['nullable', 'date'],
            'bulan_entry' => ['nullable', 'string', 'max:50'],
            'caption' => ['nullable', 'string'],
            'link' => ['nullable', 'string', 'max:2000'],
            'brand' => [
                'required',
                'string',
                Rule::in([
                    'Honda',
                    'Kawasaki',
                    'Yamaha',
                    'Aprilia',
                    'TVS',
                    'Bajaj',
                    'KTM',
                    'Piaggio',
                    'MV Agusta',
                    'All Brand',
                ]),
            ],
            'total_komentar' => ['nullable', 'integer', 'min:0'],
            'total_views' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'social_media_profile_id' => 'Nama Lengkap',
            'jenis_sosmed' => 'Jenis Sosmed',
            'tanggal_rilis' => 'Tanggal Rilis',
            'bulan_entry' => 'Bulan Entry',
            'caption' => 'Caption',
            'link' => 'Link Postingan',
            'brand' => 'Brand',
            'total_komentar' => 'Total Komentar',
            'total_views' => 'Total Views',
        ];
    }
}
